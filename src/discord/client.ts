import { createHash } from "node:crypto";
import { STATUS_CODES } from "node:http";

import {
  Clock,
  Context,
  Effect,
  Layer,
  Random,
  Redacted,
  Schema,
} from "effect";
import { FetchHttpClient, HttpClient } from "effect/http";
import type { HttpClientResponse } from "effect/http";

import {
  IndexNotReadyResponseSchema,
  RateLimitBodySchema,
  SearchResponseSchema,
} from "@/discord/schemas.ts";
import type { SearchResponse } from "@/discord/schemas.ts";
import {
  DiscordApiError,
  IndexNotReadyError,
  RateLimitExhaustedError,
  ValidationError,
} from "@/errors.ts";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_INDEX_RETRIES = 5;
const DEFAULT_INDEX_DELAY_SECONDS = 2;
const REQUEST_TIMEOUT_MS = 30_000;

type RateLimitState = {
  remaining: number;
  resetAt: number;
};

type SearchRequest = {
  guildId: string;
  query: string;
  token: Redacted.Redacted;
};

const decodeJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Unknown)
);

const readJson = (response: HttpClientResponse.HttpClientResponse) =>
  response.text.pipe(Effect.flatMap(decodeJson));

type DiscordSearchError =
  | DiscordApiError
  | IndexNotReadyError
  | RateLimitExhaustedError
  | ValidationError;

type DiscordClientService = {
  readonly search: (
    request: SearchRequest
  ) => Effect.Effect<SearchResponse, DiscordSearchError>;
};

/** Fetch authenticated search pages and coordinate Discord rate limits. */
export class DiscordClient extends Context.Service<
  DiscordClient,
  DiscordClientService
>()("@discord-search/DiscordClient") {}

const make = Effect.gen(function* make() {
  const http = HttpClient.withScope(yield* HttpClient.HttpClient);
  const rateLimits = new Map<string, RateLimitState>();

  const waitForBucket = Effect.fn("DiscordClient.waitForBucket")(
    function* waitForBucket(bucketKey: string) {
      const bucket = rateLimits.get(bucketKey);

      if (bucket === undefined) {
        return;
      }

      if (bucket.remaining > 0) {
        bucket.remaining -= 1;
      } else if (bucket.remaining === 0) {
        const now = yield* Clock.currentTimeMillis;

        if (bucket.resetAt > now) {
          yield* Effect.sleep(bucket.resetAt - now);
        }
      }
    }
  );

  const updateBucket = Effect.fn("DiscordClient.updateBucket")(
    function* updateBucket(
      bucketKey: string,
      headers: HttpClientResponse.HttpClientResponse["headers"]
    ) {
      const remaining = headers["x-ratelimit-remaining"];
      const resetAfter = headers["x-ratelimit-reset-after"];

      if (remaining !== undefined || resetAfter !== undefined) {
        const now = yield* Clock.currentTimeMillis;

        const previous = rateLimits.get(bucketKey);
        rateLimits.set(bucketKey, {
          remaining:
            remaining === undefined
              ? (previous?.remaining ?? 1)
              : Math.trunc(Number(remaining)),
          resetAt:
            resetAfter === undefined
              ? (previous?.resetAt ?? now)
              : now + Number(resetAfter) * 1000,
        });
      }
    }
  );

  const search = Effect.fn("DiscordClient.search")(function* search({
    guildId,
    query,
    token,
  }: SearchRequest) {
    const url = `${DISCORD_API_BASE}/guilds/${encodeURIComponent(guildId)}/messages/search?${query}`;
    const authorization = Redacted.value(token);
    const tokenKey = createHash("sha256").update(authorization).digest("hex");
    const bucketKey = `${guildId}:${tokenKey}`;
    let rateLimitRetries = 0;
    let indexRetries = 0;
    let indexDelay: number | undefined;

    for (;;) {
      if (indexDelay !== undefined) {
        yield* Effect.sleep(indexDelay * 1000);
      }

      yield* waitForBucket(bucketKey);

      const { json, status } = yield* http
        .get(url, {
          headers: {
            authorization: `Bot ${authorization}`,
            "content-type": "application/json",
          },
        })
        .pipe(
          Effect.tap((response) => updateBucket(bucketKey, response.headers)),
          Effect.flatMap((response) =>
            Effect.result(readJson(response)).pipe(
              Effect.map((result) => ({
                json: result,
                status: response.status,
              }))
            )
          ),
          Effect.scoped,
          Effect.timeoutOrElse({
            duration: REQUEST_TIMEOUT_MS,
            orElse: () =>
              Effect.fail(
                new DiscordApiError({
                  body: null,
                  message: `Request timed out after ${REQUEST_TIMEOUT_MS}ms`,
                  status: 0,
                })
              ),
          }),
          Effect.catchTag(
            "HttpClientError",
            () =>
              new DiscordApiError({
                body: null,
                message: "Network error communicating with Discord",
                status: 0,
              })
          )
        );

      if (status === 202) {
        const retryAfter = yield* Effect.fromResult(json).pipe(
          Effect.flatMap(
            Schema.decodeUnknownEffect(IndexNotReadyResponseSchema)
          ),
          Effect.map(({ retry_after }) =>
            retry_after > 0 ? retry_after : DEFAULT_INDEX_DELAY_SECONDS
          ),
          Effect.orElseSucceed(() => DEFAULT_INDEX_DELAY_SECONDS)
        );

        if (indexRetries >= MAX_INDEX_RETRIES) {
          return yield* new IndexNotReadyError({
            message: `Index still not available after ${MAX_INDEX_RETRIES} retries`,
            retryAfter,
          });
        }

        indexRetries += 1;
        indexDelay = retryAfter;
      } else if (status === 429) {
        const body = yield* Effect.fromResult(json).pipe(
          Effect.mapError(
            () =>
              new DiscordApiError({
                body: null,
                message: "Failed to parse 429 response body",
                status: 429,
              })
          )
        );

        const { retry_after: retryAfter } = yield* Schema.decodeUnknownEffect(
          RateLimitBodySchema
        )(body).pipe(
          Effect.mapError(
            () =>
              new DiscordApiError({
                body,
                message: "Invalid 429 response body",
                status: 429,
              })
          )
        );

        if (rateLimitRetries >= MAX_RATE_LIMIT_RETRIES) {
          return yield* new RateLimitExhaustedError({
            message: `Rate limited after ${MAX_RATE_LIMIT_RETRIES} retries`,
            retryAfter,
          });
        }

        const jitter = yield* Random.next;
        yield* Effect.sleep(
          retryAfter * 1000 * 2 ** rateLimitRetries + jitter * 1000
        );
        rateLimitRetries += 1;
      } else if (status < 200 || status >= 300) {
        const body = yield* Effect.fromResult(json).pipe(
          Effect.orElseSucceed(() => null)
        );

        const statusText = STATUS_CODES[status] ?? "";

        return yield* new DiscordApiError({
          body,
          status,
          message: `Discord API error: ${status} ${statusText}`.trimEnd(),
        });
      } else {
        const body = yield* Effect.fromResult(json).pipe(
          Effect.mapError(
            () =>
              new DiscordApiError({
                body: null,
                message: "Failed to parse response JSON",
                status,
              })
          )
        );

        return yield* Schema.decodeUnknownEffect(SearchResponseSchema)(
          body
        ).pipe(
          Effect.mapError(
            () =>
              new ValidationError({
                message: "Discord API response validation failed",
              })
          )
        );
      }
    }
  });

  return DiscordClient.of({ search });
});

export const layerWithoutDependencies = Layer.effect(DiscordClient, make);

export const layer = layerWithoutDependencies.pipe(
  Layer.provide(FetchHttpClient.layer)
);
