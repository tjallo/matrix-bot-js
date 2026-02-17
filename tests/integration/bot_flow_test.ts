import { assertEquals, assertStringIncludes } from "@std/assert";
import { createBot } from "../../src/bot.ts";
import {
  makeTextEvent,
  MemoryStorage,
  MockMatrixClient,
  testConfig,
} from "../helpers.ts";

function setup(configOverrides?: Parameters<typeof testConfig>[0]) {
  const client = new MockMatrixClient();
  const storage = new MemoryStorage();
  const config = testConfig(configOverrides);
  const startTime = new Date("2025-06-15T10:00:00Z");
  const bot = createBot({ client, storage, config, startTime });
  return { client, storage, config, bot };
}

// -----------------------------------------------------------------------
// End-to-end: message event -> bot -> command handler -> response
// -----------------------------------------------------------------------

Deno.test("integration: !ping responds with Pong!", async () => {
  const { client, bot } = setup();
  const event = makeTextEvent("@alice:matrix.test", "!ping");
  await bot.handleMessage("!room:test", event);
  assertEquals(client.lastSentText(), "Pong!");
});

Deno.test("integration: ignores messages from the bot itself", async () => {
  const { client, bot, config } = setup();
  const event = makeTextEvent(config.userId, "!ping");
  await bot.handleMessage("!room:test", event);
  assertEquals(client.sent.length, 0);
});

Deno.test("integration: ignores non-text messages", async () => {
  const { client, bot } = setup();
  const event = {
    type: "m.room.message",
    sender: "@alice:matrix.test",
    content: { msgtype: "m.image", body: "photo.jpg" },
  };
  await bot.handleMessage("!room:test", event);
  assertEquals(client.sent.length, 0);
});

Deno.test("integration: ignores messages without prefix", async () => {
  const { client, bot } = setup();
  const event = makeTextEvent("@alice:matrix.test", "hello everyone");
  await bot.handleMessage("!room:test", event);
  assertEquals(client.sent.length, 0);
});

Deno.test("integration: unknown command responds with hint", async () => {
  const { client, bot } = setup();
  const event = makeTextEvent("@alice:matrix.test", "!nonexistent");
  await bot.handleMessage("!room:test", event);
  assertStringIncludes(client.lastSentText()!, "Unknown command");
  assertStringIncludes(client.lastSentText()!, "!help");
});

Deno.test("integration: custom prefix works", async () => {
  const { client, bot } = setup({ prefix: "bot:" });
  const event = makeTextEvent("@alice:matrix.test", "bot:ping");
  await bot.handleMessage("!room:test", event);
  assertEquals(client.lastSentText(), "Pong!");
});

Deno.test("integration: !echo sends back the text", async () => {
  const { client, bot } = setup();
  const event = makeTextEvent("@alice:matrix.test", "!echo foo bar");
  await bot.handleMessage("!room:test", event);
  assertEquals(client.lastSentText(), "foo bar");
});

Deno.test("integration: !help lists commands", async () => {
  const { client, bot } = setup();
  const event = makeTextEvent("@alice:matrix.test", "!help");
  await bot.handleMessage("!room:test", event);
  assertStringIncludes(client.lastSentText()!, "!ping");
  assertStringIncludes(client.lastSentText()!, "!echo");
});

Deno.test("integration: !time shows server time", async () => {
  const { client, bot } = setup();
  const event = makeTextEvent("@alice:matrix.test", "!time");
  await bot.handleMessage("!room:test", event);
  assertStringIncludes(client.lastSentText()!, "Server time:");
});

Deno.test("integration: !uptime shows formatted duration", async () => {
  const { client, bot } = setup();
  const event = makeTextEvent("@alice:matrix.test", "!uptime");
  await bot.handleMessage("!room:test", event);
  assertStringIncludes(client.lastSentText()!, "Uptime:");
});

Deno.test("integration: !roll produces a result", async () => {
  const { client, bot } = setup();
  const event = makeTextEvent("@alice:matrix.test", "!roll 3d6");
  await bot.handleMessage("!room:test", event);
  assertStringIncludes(client.lastSentText()!, "3d6");
  assertStringIncludes(client.lastSentText()!, "total");
});

Deno.test("integration: !whoami shows caller info", async () => {
  const { client, bot } = setup();
  const event = makeTextEvent("@alice:matrix.test", "!whoami");
  await bot.handleMessage("!room:test", event);
  assertStringIncludes(client.lastSentText()!, "@alice:matrix.test");
});

Deno.test("integration: stats are persisted across commands", async () => {
  const { client, bot } = setup();

  // Run a few commands
  await bot.handleMessage(
    "!room:test",
    makeTextEvent("@alice:matrix.test", "!ping"),
  );
  await bot.handleMessage(
    "!room:test",
    makeTextEvent("@alice:matrix.test", "!ping"),
  );
  await bot.handleMessage(
    "!room:test",
    makeTextEvent("@alice:matrix.test", "!time"),
  );

  // Now check stats
  await bot.handleMessage(
    "!room:test",
    makeTextEvent("@alice:matrix.test", "!stats"),
  );

  const text = client.lastSentText()!;
  // 3 prior commands + the stats command itself = 4
  assertStringIncludes(text, "Commands run: 4");
  assertStringIncludes(text, "ping: 2");
});

Deno.test("integration: handler error produces error message", async () => {
  const { client, bot } = setup();

  // Overwrite the registry entry with a failing handler
  bot.registry.register({
    name: "explode",
    summary: "always fails",
    handler: async () => {
      throw new Error("boom");
    },
  });

  const event = makeTextEvent("@alice:matrix.test", "!explode");
  await bot.handleMessage("!room:test", event);
  // The stats command is recorded, then the handler throws, so we get an error message
  assertStringIncludes(
    client.lastSentText()!,
    "Something went wrong",
  );
});

Deno.test("integration: multiple rooms are independent", async () => {
  const { client, bot } = setup();

  await bot.handleMessage(
    "!room1:test",
    makeTextEvent("@alice:matrix.test", "!ping"),
  );
  await bot.handleMessage(
    "!room2:test",
    makeTextEvent("@bob:matrix.test", "!echo hi"),
  );

  assertEquals(client.sent.length, 2);
  assertEquals(client.sent[0].roomId, "!room1:test");
  assertEquals(client.sent[0].text, "Pong!");
  assertEquals(client.sent[1].roomId, "!room2:test");
  assertEquals(client.sent[1].text, "hi");
});
