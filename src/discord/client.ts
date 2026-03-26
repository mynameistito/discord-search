import { Result } from "better-result";
import { z } from "zod";
import { IndexNotReadyResponseSchema } from "@/discord/schemas.ts";
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

const RateLimitBodySchema = z.object({
  retry_after: z.number(),
});

type RateLimitState = {
  lastRequestTime: number;
  remaining: number;
  resetAfterMs: number;
};

const rateLimitState: RateLimitState = {
  remaining: 1,
  resetAfterMs: 0,
  lastRequestTime: 0,
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const updateRateLimitState = (headers: Headers): void => {
  const remaining = headers.get("X-RateLimit-Remaining");
  const resetAfter = headers.get("X-RateLimit-Reset-After");

  if (remaining !== null) {
    rateLimitState.remaining = Number.parseInt(remaining, 10);
  }
  if (resetAfter !== null) {
    rateLimitState.resetAfterMs = Number.parseFloat(resetAfter) * 1000;
  }
  rateLimitState.lastRequestTime = Date.now();
};

const waitForRateLimit = async (): Promise<void> => {
  if (rateLimitState.remaining > 0) {
    return;
  }

  const elapsed = Date.now() - rateLimitState.lastRequestTime;
  const waitTime = rateLimitState.resetAfterMs - elapsed;

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
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Result<Response, DiscordApiError>> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const result = await Result.tryPromise({
    try: () =>
      fetch(url, { headers: makeHeaders(token), signal: controller.signal }),
    catch: (cause) => {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        return new DiscordApiError({
          message: `Request timed out after ${timeoutMs}ms`,
          status: 0,
          body: null,
        });
      }
      return new DiscordApiError({
        message: `Network error: ${cause instanceof Error ? cause.message : String(cause)}`,
        status: 0,
        body: null,
      });
    },
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
  attempt: number,
  maxRetries: number
): Promise<Result<"retry", DiscordApiError | RateLimitExhaustedError>> => {
  const bodyResult = await Result.tryPromise({
    try: () => response.json() as Promise<unknown>,
    catch: () =>
      new DiscordApiError({
        message: "Failed to parse 429 response body",
        status: 429,
        body: null,
      }),
  });

  if (bodyResult.isErr()) {
    return bodyResult;
  }

  const parsed = RateLimitBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return Result.err(
      new DiscordApiError({
        message: "Invalid 429 response body",
        status: 429,
        body: bodyResult.value,
      })
    );
  }

  const retryAfter = parsed.data.retry_after;

  if (attempt >= maxRetries) {
    return Result.err(
      new RateLimitExhaustedError({
        message: `Rate limited after ${maxRetries} retries`,
        retryAfter,
      })
    );
  }

  const backoffMs = retryAfter * 1000 * 2 ** attempt + Math.random() * 1000;
  await sleep(backoffMs);
  return Result.ok("retry" as const);
};

const parseRetryAfterFrom202 = async (response: Response): Promise<number> => {
  const bodyResult = await Result.tryPromise({
    try: () => response.json() as Promise<unknown>,
    catch: () => null,
  });

  if (bodyResult.isErr()) {
    return DEFAULT_RETRY_DELAY_SECONDS;
  }

  const parsed = IndexNotReadyResponseSchema.safeParse(bodyResult.value);
  return parsed.success
    ? parsed.data.retry_after || DEFAULT_RETRY_DELAY_SECONDS
    : DEFAULT_RETRY_DELAY_SECONDS;
};

const handle202 = async <T>(
  response: Response,
  url: string,
  token: string,
  schema: z.ZodType<T>,
  maxRetries: number
): Promise<Result<T, DiscordFetchError>> => {
  let retryAfter = await parseRetryAfterFrom202(response);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await sleep(retryAfter * 1000);
    await waitForRateLimit();

    const retryResult = await fetchWithAuth(url, token);
    if (retryResult.isErr()) {
      return retryResult;
    }

    const retryResponse = retryResult.value;
    updateRateLimitState(retryResponse.headers);

    if (retryResponse.status === 429) {
      const rateLimitResult = await handle429(
        retryResponse,
        attempt,
        maxRetries
      );
      if (rateLimitResult.isErr()) {
        return rateLimitResult;
      }
      continue;
    }

    if (retryResponse.status === 202) {
      retryAfter = await parseRetryAfterFrom202(retryResponse);
      continue;
    }

    if (!retryResponse.ok) {
      return await handleErrorResponse(retryResponse);
    }

    return await parseResponse(retryResponse, schema);
  }

  return Result.err(
    new IndexNotReadyError({
      message: `Index still not available after ${maxRetries} retries`,
      retryAfter,
    })
  );
};

const handleErrorResponse = async (
  response: Response
): Promise<Result<never, DiscordApiError>> => {
  const bodyResult = await Result.tryPromise({
    try: () => response.json() as Promise<unknown>,
    catch: () => null as unknown,
  });

  return Result.err(
    new DiscordApiError({
      message: `Discord API error: ${response.status} ${response.statusText}`,
      status: response.status,
      body: bodyResult.isOk() ? bodyResult.value : null,
    })
  );
};

const parseResponse = async <T>(
  response: Response,
  schema: z.ZodType<T>
): Promise<Result<T, DiscordApiError | ValidationError>> => {
  const jsonResult = await Result.tryPromise({
    try: () => response.json() as Promise<unknown>,
    catch: (cause) =>
      new DiscordApiError({
        message: `Failed to parse response JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        status: response.status,
        body: null,
      }),
  });

  if (jsonResult.isErr()) {
    return jsonResult;
  }

  const parsed = schema.safeParse(jsonResult.value);

  if (!parsed.success) {
    return Result.err(
      new ValidationError({
        message: "Discord API response validation failed",
        issues: parsed.error.issues,
      })
    );
  }

  return Result.ok(parsed.data);
};

export const discordFetch = async <T>(
  path: string,
  schema: z.ZodType<T>,
  token: string,
  maxRetries429 = DEFAULT_MAX_RETRIES_429,
  maxRetries202 = DEFAULT_MAX_RETRIES_202
): Promise<Result<T, DiscordFetchError>> => {
  const url = `${DISCORD_API_BASE}${path}`;

  for (let attempt = 0; attempt <= maxRetries429; attempt++) {
    await waitForRateLimit();

    const fetchResult = await fetchWithAuth(url, token);
    if (fetchResult.isErr()) {
      return fetchResult;
    }

    const response = fetchResult.value;
    updateRateLimitState(response.headers);

    if (response.status === 429) {
      const result = await handle429(response, attempt, maxRetries429);
      if (result.isErr()) {
        return result;
      }
      continue;
    }

    if (response.status === 202) {
      return await handle202(response, url, token, schema, maxRetries202);
    }

    if (!response.ok) {
      return await handleErrorResponse(response);
    }

    return await parseResponse(response, schema);
  }

  return Result.err(
    new RateLimitExhaustedError({
      message: "Rate limit retries exhausted",
      retryAfter: 0,
    })
  );
};
