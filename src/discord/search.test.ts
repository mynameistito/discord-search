import { Effect, Fiber, Layer, Result } from "effect";
import { HttpClient, HttpClientResponse } from "effect/http";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";

import { layerWithoutDependencies } from "@/discord/client.ts";
import { searchAllMessages, searchMessages } from "@/discord/search.ts";

const guildId = "12345678901234567";
const firstId = "12345678901234569";
const nextId = "12345678901234568";
const token = "fixture";

const makeMessage = (id: string) => ({
  id,
  author: { id: guildId, username: "a" },
  channel_id: guildId,
  content: "match",
  timestamp: "2026-01-01T00:00:00Z",
});

const clientLayer = (respond: (url: URL) => Response) =>
  layerWithoutDependencies.pipe(
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request, url) =>
          Effect.sync(() => HttpClientResponse.fromWeb(request, respond(url)))
        )
      )
    )
  );

describe("Discord search", () => {
  it("keeps the requested bound on the first page and resumes with a snowflake cursor", async () => {
    const queries: string[] = [];
    const pages: string[][] = [];
    const bound = "12345678901234570";

    const client = clientLayer((url) => {
      queries.push(url.search);
      const id = url.searchParams.get("max_id") === bound ? firstId : nextId;

      return Response.json({ messages: [[makeMessage(id)]], total_results: 2 });
    });

    const result = await Effect.runPromise(
      searchAllMessages(
        { guildId, maxId: bound, offset: 9975, limit: 1 },
        token,
        undefined,
        (page) => {
          pages.push(page.map((message) => message.id));
        }
      ).pipe(Effect.provide(client))
    );

    const params = queries.map((query) => new URLSearchParams(query));

    expect(result.map((message) => message.id)).toStrictEqual([
      firstId,
      nextId,
    ]);
    expect(pages).toStrictEqual([[firstId], [nextId]]);
    expect(params.map((query) => query.get("offset"))).toStrictEqual([
      "9975",
      "0",
    ]);
    expect(params.map((query) => query.get("max_id"))).toStrictEqual([
      bound,
      firstId,
    ]);
  });

  it("returns a validation failure for a malformed successful response", async () => {
    const client = clientLayer(() =>
      Response.json({ messages: [], total_results: "unknown" })
    );

    const result = await Effect.runPromise(
      searchMessages({ guildId }, token).pipe(
        Effect.result,
        Effect.provide(client)
      )
    );

    expect(Result.isFailure(result) && result.failure._tag).toBe(
      "ValidationError"
    );
  });

  it("keeps the HTTP status when a successful response has no JSON body", async () => {
    const client = clientLayer(() => new Response(null, { status: 204 }));

    const result = await Effect.runPromise(
      searchMessages({ guildId }, token).pipe(
        Effect.result,
        Effect.provide(client)
      )
    );

    expect(Result.isFailure(result) && result.failure).toMatchObject({
      _tag: "DiscordApiError",
      status: 204,
    });
  });

  it("times out when response headers arrive but the body stalls", async () => {
    const client = clientLayer(() => new Response(new ReadableStream()));

    const result = await Effect.runPromise(
      Effect.gen(function* checkRequestTimeout() {
        const fiber = yield* searchMessages({ guildId }, token).pipe(
          Effect.result,
          Effect.forkChild
        );

        yield* TestClock.adjust("30 seconds");

        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(client), Effect.provide(TestClock.layer()))
    );

    expect(Result.isFailure(result) && result.failure).toMatchObject({
      _tag: "DiscordApiError",
      message: "Request timed out after 30000ms",
      status: 0,
    });
  });

  it("waits on a zero indexing delay and stops after five retries", async () => {
    let requests = 0;

    const client = clientLayer(() => {
      requests += 1;

      return Response.json(
        { code: 123, message: "Indexing", retry_after: requests === 1 ? 0 : 1 },
        { status: 202 }
      );
    });

    const result = await Effect.runPromise(
      Effect.gen(function* checkIndexRetries() {
        const fiber = yield* searchMessages({ guildId }, token).pipe(
          Effect.result,
          Effect.forkChild
        );

        yield* TestClock.adjust("1 second");
        expect(requests).toBe(1);

        yield* TestClock.adjust("5 seconds");

        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(client), Effect.provide(TestClock.layer()))
    );

    expect(Result.isFailure(result) && result.failure._tag).toBe(
      "IndexNotReadyError"
    );
    expect(requests).toBe(6);
  });
});
