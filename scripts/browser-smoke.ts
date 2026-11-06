import { browseMessages } from "@/cli/browser.ts";

// The smoke process supplies a deterministic terminal boundary without needing a live Discord request.
Object.defineProperty(process.stdin, "isTTY", {
  configurable: true,
  value: true,
});

Object.defineProperty(process.stdin, "setRawMode", {
  configurable: true,
  value: () => process.stdin,
});

setImmediate(() => {
  process.stdin.emit("data", "q");
});

await browseMessages([
  {
    author: { id: "123", username: "smoke" },
    channel_id: "123",
    content: "browser smoke message",
    id: "123",
    timestamp: "2026-01-01T00:00:00.000Z",
  },
]);

process.stdout.write("Browser smoke passed\n");
