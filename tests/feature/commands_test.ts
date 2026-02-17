import { assertEquals, assertStringIncludes } from "@std/assert";
import { createCommandRegistry } from "../../src/commands/handlers.ts";
import type { CommandContext } from "../../src/commands/types.ts";
import {
  makeTextEvent,
  MemoryStorage,
  MockMatrixClient,
  testConfig,
} from "../helpers.ts";

function makeCtx(
  overrides: Partial<CommandContext> = {},
): CommandContext {
  const client = new MockMatrixClient();
  const storage = new MemoryStorage();
  const config = testConfig();
  const registry = createCommandRegistry();
  const now = new Date("2025-06-15T12:00:00Z");
  const startTime = new Date("2025-06-15T11:00:00Z");
  return {
    roomId: "!room:matrix.test",
    event: makeTextEvent("@user:matrix.test", ""),
    sender: "@user:matrix.test",
    args: [],
    rawArgs: "",
    config,
    client,
    storage,
    now,
    startTime,
    registry,
    ...overrides,
  };
}

// -----------------------------------------------------------------------
// !ping
// -----------------------------------------------------------------------

Deno.test("ping: responds with Pong!", async () => {
  const ctx = makeCtx();
  const def = ctx.registry.get("ping")!;
  await def.handler(ctx);
  assertEquals((ctx.client as MockMatrixClient).lastSentText(), "🏓 Pong!");
});

// -----------------------------------------------------------------------
// !echo
// -----------------------------------------------------------------------

Deno.test("echo: echoes text back", async () => {
  const ctx = makeCtx({ rawArgs: "hello world", args: ["hello", "world"] });
  const def = ctx.registry.get("echo")!;
  await def.handler(ctx);
  assertEquals((ctx.client as MockMatrixClient).lastSentText(), "hello world");
});

Deno.test("echo: shows usage when no args", async () => {
  const ctx = makeCtx({ rawArgs: "", args: [] });
  const def = ctx.registry.get("echo")!;
  await def.handler(ctx);
  assertStringIncludes(
    (ctx.client as MockMatrixClient).lastSentText()!,
    "Usage:",
  );
});

// -----------------------------------------------------------------------
// !time
// -----------------------------------------------------------------------

Deno.test("time: shows ISO timestamp", async () => {
  const now = new Date("2025-06-15T12:00:00Z");
  const ctx = makeCtx({ now });
  const def = ctx.registry.get("time")!;
  await def.handler(ctx);
  assertStringIncludes(
    (ctx.client as MockMatrixClient).lastSentText()!,
    "2025-06-15T12:00:00.000Z",
  );
});

// -----------------------------------------------------------------------
// !uptime
// -----------------------------------------------------------------------

Deno.test("uptime: shows formatted duration", async () => {
  const startTime = new Date("2025-06-15T11:00:00Z");
  const now = new Date("2025-06-15T12:00:00Z"); // 1 hour later
  const ctx = makeCtx({ startTime, now });
  const def = ctx.registry.get("uptime")!;
  await def.handler(ctx);
  assertStringIncludes(
    (ctx.client as MockMatrixClient).lastSentText()!,
    "1h 0m 0s",
  );
});

// -----------------------------------------------------------------------
// !roll
// -----------------------------------------------------------------------

Deno.test("roll: default 1d6 produces valid range", async () => {
  const ctx = makeCtx({ args: [], rawArgs: "" });
  const def = ctx.registry.get("roll")!;
  await def.handler(ctx);
  const text = (ctx.client as MockMatrixClient).lastSentText()!;
  assertStringIncludes(text, "1d6");
});

Deno.test("roll: parses NdM notation", async () => {
  const ctx = makeCtx({ args: ["2d20"], rawArgs: "2d20" });
  const def = ctx.registry.get("roll")!;
  await def.handler(ctx);
  const text = (ctx.client as MockMatrixClient).lastSentText()!;
  assertStringIncludes(text, "2d20");
});

Deno.test("roll: shows usage for invalid spec", async () => {
  const ctx = makeCtx({ args: ["abc"], rawArgs: "abc" });
  const def = ctx.registry.get("roll")!;
  await def.handler(ctx);
  assertStringIncludes(
    (ctx.client as MockMatrixClient).lastSentText()!,
    "Usage:",
  );
});

// -----------------------------------------------------------------------
// !whoami
// -----------------------------------------------------------------------

Deno.test("whoami: shows sender, version and github link", async () => {
  const ctx = makeCtx();
  const def = ctx.registry.get("whoami")!;
  await def.handler(ctx);
  const text = (ctx.client as MockMatrixClient).lastSentText()!;
  assertStringIncludes(text, "@user:matrix.test");
  assertStringIncludes(text, "Bot version:");
  assertStringIncludes(text, "github.com/tjallo/matrix-bot-js");
  assertEquals(text.includes("@bot:matrix.test"), false);
  assertEquals(text.includes("Device ID"), false);
});

// -----------------------------------------------------------------------
// !help
// -----------------------------------------------------------------------

Deno.test("help: lists all commands", async () => {
  const ctx = makeCtx();
  const def = ctx.registry.get("help")!;
  await def.handler(ctx);
  const text = (ctx.client as MockMatrixClient).lastSentText()!;
  assertStringIncludes(text, "!ping");
  assertStringIncludes(text, "!echo");
  assertStringIncludes(text, "!help");
});

Deno.test("help: shows detail for specific command", async () => {
  const ctx = makeCtx({ args: ["echo"], rawArgs: "echo" });
  const def = ctx.registry.get("help")!;
  await def.handler(ctx);
  const text = (ctx.client as MockMatrixClient).lastSentText()!;
  assertStringIncludes(text, "Echo back text");
  assertStringIncludes(text, "Usage:");
});

Deno.test("help: unknown command", async () => {
  const ctx = makeCtx({ args: ["nope"], rawArgs: "nope" });
  const def = ctx.registry.get("help")!;
  await def.handler(ctx);
  assertStringIncludes(
    (ctx.client as MockMatrixClient).lastSentText()!,
    "Unknown command: nope",
  );
});

// -----------------------------------------------------------------------
// !encryptstatus
// -----------------------------------------------------------------------

Deno.test("encryptstatus: reports enabled when encryption event exists", async () => {
  const client = new MockMatrixClient();
  client.roomStateEvents.set("!room:matrix.test::m.room.encryption", {
    algorithm: "m.megolm.v1.aes-sha2",
  });
  const ctx = makeCtx({ client });
  const def = ctx.registry.get("encryptstatus")!;
  await def.handler(ctx);
  assertStringIncludes(
    (ctx.client as MockMatrixClient).lastSentText()!,
    "enabled",
  );
});

Deno.test("encryptstatus: reports disabled when no encryption event", async () => {
  const ctx = makeCtx();
  const def = ctx.registry.get("encryptstatus")!;
  await def.handler(ctx);
  assertStringIncludes(
    (ctx.client as MockMatrixClient).lastSentText()!,
    "disabled",
  );
});

// -----------------------------------------------------------------------
// !roominfo
// -----------------------------------------------------------------------

Deno.test("roominfo: shows room details", async () => {
  const client = new MockMatrixClient();
  client.roomStateEvents.set("!room:matrix.test::m.room.name", {
    name: "Test Room",
  });
  client.roomState.set("!room:matrix.test", [
    { type: "m.room.member", content: { membership: "join" } },
    { type: "m.room.member", content: { membership: "join" } },
    { type: "m.room.member", content: { membership: "leave" } },
  ]);
  const ctx = makeCtx({ client });
  const def = ctx.registry.get("roominfo")!;
  await def.handler(ctx);
  const text = (ctx.client as MockMatrixClient).lastSentText()!;
  assertStringIncludes(text, "Test Room");
  assertStringIncludes(text, "Members: 2");
});

// -----------------------------------------------------------------------
// !stats
// -----------------------------------------------------------------------

Deno.test("stats: shows usage stats", async () => {
  const storage = new MemoryStorage();
  const { recordCommand } = await import("../../src/services/stats.ts");
  await recordCommand(storage, "ping", new Date());
  await recordCommand(storage, "ping", new Date());

  const ctx = makeCtx({ storage });
  const def = ctx.registry.get("stats")!;
  await def.handler(ctx);
  const text = (ctx.client as MockMatrixClient).lastSentText()!;
  assertStringIncludes(text, "Commands run: 2");
  assertStringIncludes(text, "ping: 2");
});

// -----------------------------------------------------------------------
// !version
// -----------------------------------------------------------------------

Deno.test("version: includes bot and Deno version", async () => {
  const ctx = makeCtx();
  const def = ctx.registry.get("version")!;
  await def.handler(ctx);
  const text = (ctx.client as MockMatrixClient).lastSentText()!;
  assertStringIncludes(text, "Bot:");
  assertStringIncludes(text, `Deno: ${Deno.version.deno}`);
});

// -----------------------------------------------------------------------
// !suggest
// -----------------------------------------------------------------------

Deno.test("suggest: records a suggestion", async () => {
  const storage = new MemoryStorage();
  const ctx = makeCtx({
    storage,
    rawArgs: "Add a weather command",
    args: ["Add", "a", "weather", "command"],
    sender: "@alice:matrix.test",
  });
  const def = ctx.registry.get("suggest")!;
  await def.handler(ctx);
  const text = (ctx.client as MockMatrixClient).lastSentText()!;
  assertStringIncludes(text, "#1");
  assertStringIncludes(text, "Thanks!");
});

Deno.test("suggest: shows usage when no text provided", async () => {
  const ctx = makeCtx({ rawArgs: "", args: [] });
  const def = ctx.registry.get("suggest")!;
  await def.handler(ctx);
  assertStringIncludes(
    (ctx.client as MockMatrixClient).lastSentText()!,
    "Usage:",
  );
});

Deno.test("suggest: increments IDs", async () => {
  const storage = new MemoryStorage();
  const ctx1 = makeCtx({
    storage,
    rawArgs: "First idea",
    args: ["First", "idea"],
  });
  const ctx2 = makeCtx({
    storage,
    rawArgs: "Second idea",
    args: ["Second", "idea"],
  });
  await ctx1.registry.get("suggest")!.handler(ctx1);
  await ctx2.registry.get("suggest")!.handler(ctx2);
  assertStringIncludes((ctx1.client as MockMatrixClient).lastSentText()!, "#1");
  assertStringIncludes((ctx2.client as MockMatrixClient).lastSentText()!, "#2");
});

// -----------------------------------------------------------------------
// !suggestions
// -----------------------------------------------------------------------

Deno.test("suggestions: shows empty message when none exist", async () => {
  const ctx = makeCtx();
  const def = ctx.registry.get("suggestions")!;
  await def.handler(ctx);
  assertStringIncludes(
    (ctx.client as MockMatrixClient).lastSentText()!,
    "No suggestions yet",
  );
});

Deno.test("suggestions: lists suggestions with sender", async () => {
  const storage = new MemoryStorage();

  // Add two suggestions from different users
  const ctx1 = makeCtx({
    storage,
    rawArgs: "Dark mode",
    args: ["Dark", "mode"],
    sender: "@alice:matrix.test",
  });
  await ctx1.registry.get("suggest")!.handler(ctx1);

  const ctx2 = makeCtx({
    storage,
    rawArgs: "Reminder feature",
    args: ["Reminder", "feature"],
    sender: "@bob:matrix.test",
  });
  await ctx2.registry.get("suggest")!.handler(ctx2);

  // List them
  const ctx3 = makeCtx({ storage });
  await ctx3.registry.get("suggestions")!.handler(ctx3);
  const text = (ctx3.client as MockMatrixClient).lastSentText()!;
  assertStringIncludes(text, "Suggestions (2):");
  assertStringIncludes(text, "#1 [@alice:matrix.test] Dark mode");
  assertStringIncludes(text, "#2 [@bob:matrix.test] Reminder feature");
});
