import { ConfigProvider, Effect, ManagedRuntime } from "effect";

import { layer } from "@/discord/client.ts";
import type { DiscordClient } from "@/discord/client.ts";

const runtime = ManagedRuntime.make(layer);

const envLayer = ConfigProvider.layer(
  ConfigProvider.fromEnv({ preserveEmptyStrings: true })
);

/** Evaluate an operation and leave expected failures for the CLI to render.
 * @param effect - Operation to evaluate.
 * @returns The operation result.
 */
export const runOperation = async <A, E>(effect: Effect.Effect<A, E>) =>
  await Effect.runPromise(Effect.result(effect).pipe(Effect.provide(envLayer)));

/** Evaluate a search using the client shared by this CLI invocation.
 * @param effect - Search operation to evaluate.
 * @returns The search result.
 */
export const runSearch = async <A, E>(
  effect: Effect.Effect<A, E, DiscordClient>
) => await runtime.runPromise(Effect.result(effect));

/** Release the resources owned by the CLI runtime.
 * @returns A promise that resolves when disposal finishes.
 */
export const disposeRuntime = async () => {
  await runtime.dispose();
};
