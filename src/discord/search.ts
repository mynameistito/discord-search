import { Ok, type Result } from "better-result";
import { discordFetch } from "@/discord/client.ts";
import {
  MAX_OFFSET,
  type Message,
  type SearchParams,
  type SearchResponse,
  SearchResponseSchema,
} from "@/discord/schemas.ts";
import type {
  DiscordApiError,
  IndexNotReadyError,
  RateLimitExhaustedError,
  ValidationError,
} from "@/errors.ts";

const DEFAULT_PAGE_SIZE = 25;

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
    ? Math.min(params.limit, DEFAULT_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

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

export const searchMessages = async (
  params: SearchParams,
  token: string,
  offset = 0,
  maxId?: string
): Promise<Result<SearchResponse, SearchError>> => {
  const queryString = buildQueryString(params, offset, maxId);
  const path = `/guilds/${params.guildId}/messages/search?${queryString}`;

  return await discordFetch(path, SearchResponseSchema, token);
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
  const result = await searchMessages(params, token, offset, maxId);
  if (result.isErr()) {
    return result;
  }

  const data = result.value;
  const pageSize = params.limit
    ? Math.min(params.limit, DEFAULT_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  if (offset === 0 && !maxId) {
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

  Array.prototype.push.apply(state.allMessages, pageMessages);
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
  params: SearchParams,
  token: string,
  onProgress?: ProgressCallback,
  onPage?: PageCallback
): Promise<Result<Message[], SearchError>> => {
  const config: PaginationConfig = {
    searchParams: { ...params, sortBy: "timestamp", sortOrder: "desc" },
    token,
    startOffset: params.offset ?? 0,
    maxMessages: params.limit,
    pageSize: params.limit
      ? Math.min(params.limit, DEFAULT_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE,
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
