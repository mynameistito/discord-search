import { setTimeout as sleep } from "node:timers/promises";

import { Result } from "better-result";
import type { z } from "zod";

import {
  IndexNotReadyResponseSchema,
  RateLimitBodySchema,
} from "@/discord/schemas.ts";
import {
  DiscordApiError,
  IndexNotReadyError,
  RateLimitExhaustedError,
  ValidationError,
} from "@/errors.ts";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DEFAULT_MAX_RETRIES_429 = 3;
const DEFAULT_MAX_RETRIES_202 = 5;
const DEFAULT_RETRY_DELAY_SECONDS = 2;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

interface RateLimitState {
  lastRequestTime: number;
  remaining: number;
  resetAfterMs: number;
}

/**
 * Module-level rate limit state shared across all calls to discordFetch.
 * Keyed per bucket (endpoint path + token hash), so different endpoints
 * maintain independent rate limit tracking. Assumes sequential usage
 * per bucket — concurrent requests to the same bucket may race.
 */
const rateLimitBuckets = new Map<string, RateLimitState>();
const bucketKeyMap = new Map<string, string>();

const computeBucketKey = (path: string, token: string): string => {
  const [routePath] = path.split("?");
  const hashInput = `${routePath}:${token}`;
  let hash = 0;

  for (const character of hashInput) {
    const codePoint = character.codePointAt(0) ?? 0;
    hash = (hash * 31 + codePoint) % 2 ** 32;
  }

  return `bucket:${hash}`;
};

const getBucketState = (bucketKey: string): RateLimitState => {
  let state = rateLimitBuckets.get(bucketKey);

  if (!state) {
    state = {
      lastRequestTime: 0,
      remaining: 1,
      resetAfterMs: 0,
    };
    rateLimitBuckets.set(bucketKey, state);
  }

  return state;
};

const updateRateLimitState = (
  headers: Headers,
  bucketKey: string,
  computedKey: string
): string => {
  const state = getBucketState(bucketKey);
  const remaining = headers.get("X-RateLimit-Remaining");
  const resetAfter = headers.get("X-RateLimit-Reset-After");
  const bucket = headers.get("X-RateLimit-Bucket");

  let activeBucketKey = bucketKey;

  if (bucket !== null && `discord:${bucket}` !== bucketKey) {
    const discordBucketKey = `discord:${bucket}`;
    rateLimitBuckets.delete(bucketKey);
    rateLimitBuckets.set(discordBucketKey, state);
    bucketKeyMap.set(computedKey, discordBucketKey);
    activeBucketKey = discordBucketKey;
  }

  if (remaining !== null) {
    state.remaining = Math.trunc(Number(remaining));
  }

  if (resetAfter !== null) {
    state.resetAfterMs = Number(resetAfter) * 1000;
  }

  state.lastRequestTime = Date.now();

  return activeBucketKey;
};

const waitForRateLimit = async (bucketKey: string): Promise<void> => {
  const state = getBucketState(bucketKey);

  if (state.remaining > 0) {
    state.remaining -= 1;

    return;
  }

  const elapsed = Date.now() - state.lastRequestTime;
  const waitTime = state.resetAfterMs - elapsed;

  if (waitTime > 0) {
    await sleep(waitTime);
  }
};

const makeHeaders = (token: string) => ({
  Authorization: `Bot ${token}`,
  "Content-Type": "application/json",
});

const fetchWithAuth = async (
  url: string,
  token: string,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  method = "GET"
): Promise<Result<Response, DiscordApiError>> => {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const result = await Result.tryPromise({
    catch: (cause) => {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        return new DiscordApiError({
          body: null,
          message: `Request timed out after ${timeoutMs}ms`,
          status: 0,
        });
      }

      return new DiscordApiError({
        body: null,
        message: `Network error: ${cause instanceof Error ? cause.message : String(cause)}`,
        status: 0,
      });
    },
    try: async () =>
      await fetch(url, {
        headers: makeHeaders(token),
        method,
        signal: controller.signal,
      }),
  });

  clearTimeout(timer);

  return result;
};

type DiscordFetchError =
  | DiscordApiError
  | RateLimitExhaustedError
  | IndexNotReadyError
  | ValidationError;

const handle429 = async (
  response: Response,
  rateLimitAttempt: number,
  max429Retries: number
): Promise<Result<"retry", DiscordApiError | RateLimitExhaustedError>> => {
  const bodyResult = await Result.tryPromise({
    catch: () =>
      new DiscordApiError({
        body: null,
        message: "Failed to parse 429 response body",
        status: 429,
      }),
    try: async () => await response.json(),
  });

  if (bodyResult.isErr()) {
    return Result.err(bodyResult.error);
  }

  const parsed = RateLimitBodySchema.safeParse(bodyResult.value);

  if (!parsed.success) {
    return Result.err(
      new DiscordApiError({
        body: bodyResult.value,
        message: "Invalid 429 response body",
        status: 429,
      })
    );
  }

  const retryAfter = parsed.data.retry_after;

  if (rateLimitAttempt >= max429Retries) {
    return Result.err(
      new RateLimitExhaustedError({
        message: `Rate limited after ${max429Retries} retries`,
        retryAfter,
      })
    );
  }

  const backoffMs =
    retryAfter * 1000 * 2 ** rateLimitAttempt + Math.random() * 1000;

  await sleep(backoffMs);

  return Result.ok("retry" as const);
};

const parseRetryAfterFrom202 = async (response: Response): Promise<number> => {
  const bodyResult = await Result.tryPromise({
    catch: () => null,
    try: async () => await response.json(),
  });

  if (bodyResult.isErr()) {
    return DEFAULT_RETRY_DELAY_SECONDS;
  }

  const parsed = IndexNotReadyResponseSchema.safeParse(bodyResult.value);

  return parsed.success
    ? (parsed.data.retry_after ?? DEFAULT_RETRY_DELAY_SECONDS)
    : DEFAULT_RETRY_DELAY_SECONDS;
};

interface RetryCounter {
  value: number;
}

const handleErrorResponse = async (
  response: Response
): Promise<Result<never, DiscordApiError>> => {
  const bodyResult = await Result.tryPromise({
    catch: () => null,
    try: async () => await response.json(),
  });

  return Result.err(
    new DiscordApiError({
      body: bodyResult.isOk() ? bodyResult.value : null,
      message: `Discord API error: ${response.status} ${response.statusText}`,
      status: response.status,
    })
  );
};

const parseResponse = async <T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<Result<T, DiscordApiError | ValidationError>> => {
  const jsonResult = await Result.tryPromise({
    catch: (cause) =>
      new DiscordApiError({
        body: null,
        message: `Failed to parse response JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        status: response.status,
      }),
    try: async () => await response.json(),
  });

  if (jsonResult.isErr()) {
    return Result.err(jsonResult.error);
  }

  const parsed = schema.safeParse(jsonResult.value);

  if (!parsed.success) {
    return Result.err(
      new ValidationError({
        issues: parsed.error.issues,
        message: "Discord API response validation failed",
      })
    );
  }

  return Result.ok(parsed.data);
};

const handle202Attempt = async <T>(
  url: string,
  token: string,
  schema: z.ZodType<T>,
  maxRetries: number,
  maxRetries429: number,
  attempt: number,
  retryAfter: number,
  initialBucketKey: string,
  computedKey: string,
  rateLimitCounter: RetryCounter
): Promise<Result<T, DiscordFetchError>> => {
  if (attempt >= maxRetries) {
    return Result.err(
      new IndexNotReadyError({
        message: `Index still not available after ${maxRetries} retries`,
        retryAfter,
      })
    );
  }

  await sleep(retryAfter * 1000);
  await waitForRateLimit(initialBucketKey);

  const retryResult = await fetchWithAuth(url, token);

  if (retryResult.isErr()) {
    return Result.err(retryResult.error);
  }

  const retryResponse = retryResult.value;

  const bucketKey = updateRateLimitState(
    retryResponse.headers,
    initialBucketKey,
    computedKey
  );

  if (retryResponse.status === 429) {
    const rateLimitResult = await handle429(
      retryResponse,
      rateLimitCounter.value,
      maxRetries429
    );

    if (rateLimitResult.isErr()) {
      return Result.err(rateLimitResult.error);
    }

    rateLimitCounter.value += 1;

    return await handle202Attempt(
      url,
      token,
      schema,
      maxRetries,
      maxRetries429,
      attempt,
      retryAfter,
      bucketKey,
      computedKey,
      rateLimitCounter
    );
  }

  if (retryResponse.status === 202) {
    const nextRetryAfter = await parseRetryAfterFrom202(retryResponse);

    return await handle202Attempt(
      url,
      token,
      schema,
      maxRetries,
      maxRetries429,
      attempt + 1,
      nextRetryAfter,
      bucketKey,
      computedKey,
      rateLimitCounter
    );
  }

  if (!retryResponse.ok) {
    return await handleErrorResponse(retryResponse);
  }

  return await parseResponse(retryResponse, schema);
};

const handle202 = async <T>(
  response: Response,
  url: string,
  token: string,
  schema: z.ZodType<T>,
  maxRetries: number,
  maxRetries429: number,
  initialBucketKey: string,
  computedKey: string,
  rateLimitCounter: RetryCounter
): Promise<Result<T, DiscordFetchError>> =>
  await handle202Attempt(
    url,
    token,
    schema,
    maxRetries,
    maxRetries429,
    0,
    await parseRetryAfterFrom202(response),
    initialBucketKey,
    computedKey,
    rateLimitCounter
  );

const fetchWithRetries = async <T>(
  url: string,
  token: string,
  schema: z.ZodType<T>,
  maxRetries429: number,
  maxRetries202: number,
  bucketKey: string,
  computedKey: string,
  rateLimitCounter: RetryCounter
): Promise<Result<T, DiscordFetchError>> => {
  await waitForRateLimit(bucketKey);

  const fetchResult = await fetchWithAuth(url, token);

  if (fetchResult.isErr()) {
    return Result.err(fetchResult.error);
  }

  const response = fetchResult.value;

  const activeBucketKey = updateRateLimitState(
    response.headers,
    bucketKey,
    computedKey
  );

  if (response.status === 429) {
    const result = await handle429(
      response,
      rateLimitCounter.value,
      maxRetries429
    );

    if (result.isErr()) {
      return Result.err(result.error);
    }

    rateLimitCounter.value += 1;

    return await fetchWithRetries(
      url,
      token,
      schema,
      maxRetries429,
      maxRetries202,
      activeBucketKey,
      computedKey,
      rateLimitCounter
    );
  }

  if (response.status === 202) {
    return await handle202(
      response,
      url,
      token,
      schema,
      maxRetries202,
      maxRetries429,
      activeBucketKey,
      computedKey,
      rateLimitCounter
    );
  }

  if (!response.ok) {
    return await handleErrorResponse(response);
  }

  return await parseResponse(response, schema);
};

/** Fetch and validate a Discord API response with rate-limit handling.
 *
 * @param path - API path relative to the Discord API base URL.
 * @param schema - Schema used to parse the response body.
 * @param token - Discord bot token.
 * @param maxRetries429 - Maximum retries after rate limiting.
 * @param maxRetries202 - Maximum retries while the search index is preparing.
 * @returns The parsed response or a typed Discord API error.
 */
export const discordFetch = async <T>(
  path: string,
  schema: z.ZodType<T>,
  token: string,
  maxRetries429 = DEFAULT_MAX_RETRIES_429,
  maxRetries202 = DEFAULT_MAX_RETRIES_202
): Promise<Result<T, DiscordFetchError>> => {
  const url = `${DISCORD_API_BASE}${path}`;
  const computedKey = computeBucketKey(path, token);
  const bucketKey = bucketKeyMap.get(computedKey) ?? computedKey;
  const rateLimitCounter: RetryCounter = { value: 0 };

  return await fetchWithRetries(
    url,
    token,
    schema,
    maxRetries429,
    maxRetries202,
    bucketKey,
    computedKey,
    rateLimitCounter
  );
};
