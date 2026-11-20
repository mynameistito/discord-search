import { Effect, Redacted, Schema } from "effect";

import { DiscordClient } from "@/discord/client.ts";
import {
  MAX_OFFSET,
  MAX_PAGE_SIZE,
  SearchParamsSchema,
} from "@/discord/schemas.ts";
import type { Message, SearchParams } from "@/discord/schemas.ts";
import { ValidationError } from "@/errors.ts";

const buildQueryString = (
  params: SearchParams,
  offset: number,
  maxId?: string
) => {
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

  const effectiveMaxId = maxId ?? params.maxId;

  if (effectiveMaxId !== undefined && effectiveMaxId.length > 0) {
    qs.set("max_id", effectiveMaxId);
  }

  if (params.minId !== undefined && params.minId.length > 0) {
    qs.set("min_id", params.minId);
  }

  const arrayParams: [string, readonly string[] | undefined][] = [
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

/** Progress emitted while paginating Discord search results. */
export type SearchProgress = {
  fetched: number;
  total: number;
};

/** Report the number of search results retrieved so far. */
export type ProgressCallback = (progress: SearchProgress) => void;

/** Receive each page of messages as soon as it is fetched. */
export type PageCallback = (messages: Message[]) => void;

const validateSearchParams = (params: SearchParams) =>
  Schema.decodeUnknownEffect(SearchParamsSchema)(params).pipe(
    Effect.mapError(
      () => new ValidationError({ message: "Invalid search parameters" })
    )
  );

/** Search Discord messages using validated parameters. */
export const searchMessages = Effect.fn("Search.searchMessages")(
  function* searchMessages(
    params: SearchParams,
    token: string,
    offset?: number,
    maxId?: string
  ) {
    const validated = yield* validateSearchParams(params);
    const client = yield* DiscordClient;

    return yield* client.search({
      guildId: validated.guildId,
      query: buildQueryString(validated, offset ?? 0, maxId),
      token: Redacted.make(token),
    });
  }
);

const validatePaginationOrder = Effect.fn("Search.validatePaginationOrder")(
  function* validatePaginationOrder(queryParams: SearchParams) {
    if (
      queryParams.sortBy !== undefined &&
      queryParams.sortBy !== "timestamp"
    ) {
      return yield* new ValidationError({
        message:
          "searchAllMessages requires sortBy: 'timestamp' for snowflake-based pagination",
      });
    }

    if (
      queryParams.sortOrder !== undefined &&
      queryParams.sortOrder !== "desc"
    ) {
      return yield* new ValidationError({
        message:
          "searchAllMessages requires sortOrder: 'desc' for snowflake-based pagination",
      });
    }

    return null;
  }
);

/** Search Discord messages and paginate through all matching results. */
export const searchAllMessages = Effect.fn("Search.searchAllMessages")(
  function* searchAllMessages(
    params: SearchParams,
    token: string,
    onProgress?: ProgressCallback,
    onPage?: PageCallback,
    maxMessages?: number
  ) {
    const queryParams = yield* validateSearchParams(params);

    yield* validatePaginationOrder(queryParams);

    const client = yield* DiscordClient;

    const searchParams = {
      ...queryParams,
      sortBy: "timestamp",
      sortOrder: "desc",
    } as const;

    const credential = Redacted.make(token);

    const pageSize = Math.min(
      queryParams.limit ?? MAX_PAGE_SIZE,
      MAX_PAGE_SIZE
    );

    const messages: Message[] = [];
    let total: number | undefined;
    let { maxId } = queryParams;
    let offset = queryParams.offset ?? 0;

    for (;;) {
      const response = yield* client.search({
        guildId: queryParams.guildId,
        query: buildQueryString(searchParams, offset, maxId),
        token: credential,
      });

      total ??= Math.min(
        response.total_results,
        maxMessages ?? response.total_results
      );

      const page = response.messages.flatMap(([message]) =>
        message === undefined ? [] : [message]
      );

      if (page.length === 0) {
        onProgress?.({ total, fetched: messages.length });

        return messages;
      }

      const received =
        maxMessages === undefined
          ? page
          : page.slice(0, maxMessages - messages.length);

      messages.push(...received);
      onPage?.(received);
      onProgress?.({ total, fetched: messages.length });

      if (messages.length >= total) {
        return messages;
      }

      offset += pageSize;

      if (offset > MAX_OFFSET || received.length < pageSize) {
        const lastId = messages.at(-1)?.id;

        if (lastId === undefined || lastId === maxId) {
          return messages;
        }

        maxId = lastId;
        offset = 0;
      }
    }
  }
);
