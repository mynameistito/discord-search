import { Ok, Result } from "better-result";
import { discordFetch } from "@/discord/client.ts";
import {
  MAX_OFFSET,
  MAX_PAGE_SIZE,
  type Message,
  type SearchParams,
  SearchParamsSchema,
  type SearchResponse,
  SearchResponseSchema,
} from "@/discord/schemas.ts";
import type {
  DiscordApiError,
  IndexNotReadyError,
  RateLimitExhaustedError,
} from "@/errors.ts";
import { ValidationError } from "@/errors.ts";

const validateSearchParams = (
  params: unknown
): Result<SearchParams, ValidationError> => {
  const parsed = SearchParamsSchema.safeParse(params);
  if (!parsed.success) {
    return Result.err(
      new ValidationError({
        message: "Invalid search parameters",
        issues: parsed.error.issues,
      })
    );
  }
  return Result.ok(parsed.data);
};

type SearchError =
  | DiscordApiError
  | RateLimitExhaustedError
  | IndexNotReadyError
  | ValidationError;

const buildQueryString = (
  params: SearchParams,
  offset: number,
  maxId?: string
): string => {
  const qs = new URLSearchParams();
  const pageSize = params.limit
    ? Math.min(params.limit, MAX_PAGE_SIZE)
    : MAX_PAGE_SIZE;

  qs.set("limit", String(pageSize));
  qs.set("offset", String(offset));

  if (params.content) {
    qs.set("content", params.content);
  }
  if (params.pinned !== undefined) {
    qs.set("pinned", String(params.pinned));
  }
  if (params.mentionEveryone !== undefined) {
    qs.set("mention_everyone", String(params.mentionEveryone));
  }
  if (params.sortBy) {
    qs.set("sort_by", params.sortBy);
  }
  if (params.sortOrder) {
    qs.set("sort_order", params.sortOrder);
  }
  if (params.includeNsfw !== undefined) {
    qs.set("include_nsfw", String(params.includeNsfw));
  }
  if (params.slop !== undefined) {
    qs.set("slop", String(params.slop));
  }

  // Use override maxId for snowflake partitioning, otherwise use params
  const effectiveMaxId = maxId ?? params.maxId;
  if (effectiveMaxId) {
    qs.set("max_id", effectiveMaxId);
  }
  if (params.minId) {
    qs.set("min_id", params.minId);
  }

  // Array params
  const arrayParams: [string, string[] | undefined][] = [
    ["channel_id", params.channelId],
    ["author_id", params.authorId],
    ["author_type", params.authorType],
    ["mentions", params.mentions],
    ["mentions_role_id", params.mentionsRoleId],
    ["replied_to_user_id", params.repliedToUserId],
    ["replied_to_message_id", params.repliedToMessageId],
    ["has", params.has],
    ["embed_type", params.embedType],
    ["embed_provider", params.embedProvider],
    ["link_hostname", params.linkHostname],
    ["attachment_filename", params.attachmentFilename],
    ["attachment_extension", params.attachmentExtension],
  ];

  for (const [key, values] of arrayParams) {
    if (values) {
      for (const value of values) {
        qs.append(key, value);
      }
    }
  }

  return qs.toString();
};

const fetchSearch = async (
  params: SearchParams,
  token: string,
  offset: number,
  maxId?: string
): Promise<Result<SearchResponse, SearchError>> => {
  const queryString = buildQueryString(params, offset, maxId);
  const encodedGuildId = encodeURIComponent(params.guildId);
  const path = `/guilds/${encodedGuildId}/messages/search?${queryString}`;

  return await discordFetch(path, SearchResponseSchema, token);
};

export const searchMessages = async (
  params: unknown,
  token: string,
  offset = 0,
  maxId?: string
): Promise<Result<SearchResponse, SearchError>> => {
  const validatedParams = validateSearchParams(params);
  if (validatedParams.isErr()) {
    return validatedParams;
  }

  return await fetchSearch(validatedParams.value, token, offset, maxId);
};

export type SearchProgress = { fetched: number; total: number };
export type ProgressCallback = (progress: SearchProgress) => void;
export type PageCallback = (messages: Message[]) => void;

type PaginationState = {
  allMessages: Message[];
  totalResults: number;
};

const fetchPage = async (
  params: SearchParams,
  token: string,
  offset: number,
  maxId: string | undefined,
  state: PaginationState,
  maxMessages: number | undefined,
  onProgress?: ProgressCallback,
  onPage?: PageCallback
): Promise<Result<"done" | "continue" | "break", SearchError>> => {
  const result = await fetchSearch(params, token, offset, maxId);
  if (result.isErr()) {
    return result;
  }

  const data = result.value;
  const pageSize = params.limit
    ? Math.min(params.limit, MAX_PAGE_SIZE)
    : MAX_PAGE_SIZE;

  // Only capture totalResults from the first (unfiltered) response.
  // Subsequent partitions with max_id return a smaller total_results
  // scoped to the filtered range, which would cause early termination.
  if (state.totalResults === 0) {
    state.totalResults = maxMessages
      ? Math.min(data.total_results, maxMessages)
      : data.total_results;
  }

  let pageMessages = data.messages
    .map((group) => group[0])
    .filter((msg): msg is Message => msg !== undefined);

  if (pageMessages.length === 0) {
    onProgress?.({
      fetched: state.allMessages.length,
      total: state.totalResults,
    });
    return new Ok("done" as const);
  }

  // Truncate if adding this page would exceed the limit
  if (
    maxMessages &&
    state.allMessages.length + pageMessages.length > maxMessages
  ) {
    pageMessages = pageMessages.slice(
      0,
      maxMessages - state.allMessages.length
    );
  }

  for (const msg of pageMessages) {
    state.allMessages.push(msg);
  }
  onPage?.(pageMessages);
  onProgress?.({
    fetched: state.allMessages.length,
    total: state.totalResults,
  });

  if (state.allMessages.length >= state.totalResults) {
    return new Ok("done" as const);
  }

  if (pageMessages.length < pageSize) {
    return new Ok("break" as const);
  }

  return new Ok("continue" as const);
};

type PaginationConfig = {
  searchParams: SearchParams;
  token: string;
  startOffset: number;
  maxMessages: number | undefined;
  pageSize: number;
  onProgress?: ProgressCallback;
  onPage?: PageCallback;
};

const fetchPartition = async (
  config: PaginationConfig,
  state: PaginationState,
  maxId: string | undefined
): Promise<Result<"done" | "continue", SearchError>> => {
  const initialOffset = maxId ? 0 : config.startOffset;

  for (
    let offset = initialOffset;
    offset <= MAX_OFFSET;
    offset += config.pageSize
  ) {
    const pageResult = await fetchPage(
      config.searchParams,
      config.token,
      offset,
      maxId,
      state,
      config.maxMessages,
      config.onProgress,
      config.onPage
    );
    if (pageResult.isErr()) {
      return pageResult;
    }
    if (pageResult.value === "done") {
      return new Ok("done" as const);
    }
    if (pageResult.value === "break") {
      break;
    }
  }

  return new Ok("continue" as const);
};

export const searchAllMessages = async (
  params: unknown,
  token: string,
  onProgress?: ProgressCallback,
  onPage?: PageCallback,
  maxMessages?: number
): Promise<Result<Message[], SearchError>> => {
  const validatedParams = validateSearchParams(params);
  if (validatedParams.isErr()) {
    return validatedParams;
  }

  const queryParams = validatedParams.value;

  if (queryParams.sortBy && queryParams.sortBy !== "timestamp") {
    return Result.err(
      new ValidationError({
        message:
          "searchAllMessages requires sortBy: 'timestamp' for snowflake-based pagination",
        issues: [],
      })
    );
  }

  if (queryParams.sortOrder && queryParams.sortOrder !== "desc") {
    return Result.err(
      new ValidationError({
        message:
          "searchAllMessages requires sortOrder: 'desc' for snowflake-based pagination",
        issues: [],
      })
    );
  }

  const config: PaginationConfig = {
    searchParams: { ...queryParams, sortBy: "timestamp", sortOrder: "desc" },
    token,
    startOffset: queryParams.offset ?? 0,
    maxMessages,
    pageSize: queryParams.limit
      ? Math.min(queryParams.limit, MAX_PAGE_SIZE)
      : MAX_PAGE_SIZE,
    onProgress,
    onPage,
  };

  const state: PaginationState = { allMessages: [], totalResults: 0 };
  let currentMaxId: string | undefined;

  while (true) {
    const result = await fetchPartition(config, state, currentMaxId);
    if (result.isErr()) {
      return result;
    }
    if (result.value === "done") {
      break;
    }

    if (state.allMessages.length >= state.totalResults) {
      break;
    }

    const lastMessage = state.allMessages.at(-1);
    if (!lastMessage || currentMaxId === lastMessage.id) {
      break;
    }

    currentMaxId = lastMessage.id;
  }

  return new Ok(state.allMessages);
};
