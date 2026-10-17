import { Ok, Result } from "better-result";

import { discordFetch } from "@/discord/client.ts";
import {
  MAX_OFFSET,
  MAX_PAGE_SIZE,
  SearchParamsSchema,
  SearchResponseSchema,
} from "@/discord/schemas.ts";
import type {
  Message,
  SearchParams,
  SearchResponse,
} from "@/discord/schemas.ts";
import type {
  DiscordApiError,
  IndexNotReadyError,
  RateLimitExhaustedError,
} from "@/errors.ts";
import { ValidationError } from "@/errors.ts";

const validateSearchParams = (
  params: SearchParams
): Result<SearchParams, ValidationError> => {
  const parsed = SearchParamsSchema.safeParse(params);

  if (!parsed.success) {
    return Result.err(
      new ValidationError({
        issues: parsed.error.issues,
        message: "Invalid search parameters",
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

  const pageSize =
    params.limit === undefined
      ? MAX_PAGE_SIZE
      : Math.min(params.limit, MAX_PAGE_SIZE);

  qs.set("limit", String(pageSize));
  qs.set("offset", String(offset));

  if (params.content !== undefined && params.content.length > 0) {
    qs.set("content", params.content);
  }

  if (params.pinned !== undefined) {
    qs.set("pinned", String(params.pinned));
  }

  if (params.mentionEveryone !== undefined) {
    qs.set("mention_everyone", String(params.mentionEveryone));
  }

  if (params.sortBy !== undefined) {
    qs.set("sort_by", params.sortBy);
  }

  if (params.sortOrder !== undefined) {
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

  if (effectiveMaxId !== undefined && effectiveMaxId.length > 0) {
    qs.set("max_id", effectiveMaxId);
  }

  if (params.minId !== undefined && params.minId.length > 0) {
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
    if (values !== undefined) {
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

/** Search Discord messages using validated parameters.
 *
 * @param params - Validated message search filters.
 * @param token - Discord bot token.
 * @param offset - Initial result offset.
 * @param maxId - Optional upper snowflake bound.
 * @returns The search response or a typed search error.
 */
export const searchMessages = async (
  params: SearchParams,
  token: string,
  offset = 0,
  maxId?: string
): Promise<Result<SearchResponse, SearchError>> => {
  const validatedParams = validateSearchParams(params);

  if (validatedParams.isErr()) {
    return Result.err(validatedParams.error);
  }

  return await fetchSearch(validatedParams.value, token, offset, maxId);
};

/** Progress emitted while paginating Discord search results. */
export interface SearchProgress {
  fetched: number;
  total: number;
}

/** Report the number of search results retrieved so far. */
export type ProgressCallback = (progress: SearchProgress) => void;

/** Receive each page of messages as soon as it is fetched. */
export type PageCallback = (messages: Message[]) => void;

interface PaginationState {
  allMessages: Message[];
  totalResults: number;
}

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
    return Result.err(result.error);
  }

  const data = result.value;

  const pageSize =
    params.limit === undefined
      ? MAX_PAGE_SIZE
      : Math.min(params.limit, MAX_PAGE_SIZE);

  // Only capture totalResults from the first (unfiltered) response.
  // Subsequent partitions with max_id return a smaller total_results
  // scoped to the filtered range, which would cause early termination.
  if (state.totalResults === 0) {
    state.totalResults =
      maxMessages === undefined
        ? data.total_results
        : Math.min(data.total_results, maxMessages);
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
    maxMessages !== undefined &&
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

interface PaginationConfig {
  searchParams: SearchParams;
  token: string;
  startOffset: number;
  maxMessages: number | undefined;
  pageSize: number;
  onProgress?: ProgressCallback;
  onPage?: PageCallback;
}

const fetchPartitionPage = async (
  config: PaginationConfig,
  state: PaginationState,
  maxId: string | undefined,
  offset: number
): Promise<Result<"done" | "continue", SearchError>> => {
  if (offset > MAX_OFFSET) {
    return new Ok("continue" as const);
  }

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
    return Result.err(pageResult.error);
  }

  if (pageResult.value === "done") {
    return new Ok("done" as const);
  }

  if (pageResult.value === "break") {
    return new Ok("continue" as const);
  }

  return await fetchPartitionPage(
    config,
    state,
    maxId,
    offset + config.pageSize
  );
};

/** Search Discord messages and paginate through all matching results.
 *
 * @param params - Validated message search filters.
 * @param token - Discord bot token.
 * @param onProgress - Optional callback for pagination progress.
 * @param onPage - Optional callback for each fetched page.
 * @param maxMessages - Optional maximum number of messages to fetch.
 * @returns All matching messages or a typed search error.
 */
export const searchAllMessages = async (
  params: SearchParams,
  token: string,
  onProgress?: ProgressCallback,
  onPage?: PageCallback,
  maxMessages?: number
): Promise<Result<Message[], SearchError>> => {
  const validatedParams = validateSearchParams(params);

  if (validatedParams.isErr()) {
    return Result.err(validatedParams.error);
  }

  const queryParams = validatedParams.value;

  if (queryParams.sortBy !== undefined && queryParams.sortBy !== "timestamp") {
    return Result.err(
      new ValidationError({
        issues: [],
        message:
          "searchAllMessages requires sortBy: 'timestamp' for snowflake-based pagination",
      })
    );
  }

  if (queryParams.sortOrder !== undefined && queryParams.sortOrder !== "desc") {
    return Result.err(
      new ValidationError({
        issues: [],
        message:
          "searchAllMessages requires sortOrder: 'desc' for snowflake-based pagination",
      })
    );
  }

  const config: PaginationConfig = {
    maxMessages,
    onPage,
    onProgress,
    pageSize:
      queryParams.limit === undefined
        ? MAX_PAGE_SIZE
        : Math.min(queryParams.limit, MAX_PAGE_SIZE),
    searchParams: { ...queryParams, sortBy: "timestamp", sortOrder: "desc" },
    startOffset: queryParams.offset ?? 0,
    token,
  };

  const state: PaginationState = { allMessages: [], totalResults: 0 };

  const fetchPartitions = async (
    currentMaxId: string | null
  ): Promise<Result<boolean, SearchError>> => {
    const initialOffset = currentMaxId === null ? config.startOffset : 0;

    const result = await fetchPartitionPage(
      config,
      state,
      currentMaxId ?? "",
      initialOffset
    );

    if (result.isErr()) {
      return Result.err(result.error);
    }

    const shouldStop =
      result.value === "done" || state.allMessages.length >= state.totalResults;

    if (shouldStop) {
      return Result.ok(true);
    }

    const lastMessage = state.allMessages.at(-1);

    if (lastMessage === undefined || currentMaxId === lastMessage.id) {
      return Result.ok(true);
    }

    return await fetchPartitions(lastMessage.id);
  };

  const partitionResult = await fetchPartitions(null);

  if (partitionResult.isErr()) {
    return Result.err(partitionResult.error);
  }

  return new Ok(state.allMessages);
};
