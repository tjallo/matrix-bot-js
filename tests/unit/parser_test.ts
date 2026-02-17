import { assertEquals } from "@std/assert";
import { parseCommand } from "../../src/commands/parser.ts";

Deno.test("parseCommand: returns null for non-prefixed message", () => {
  assertEquals(parseCommand("hello world", "!"), null);
});

Deno.test("parseCommand: returns null for prefix-only message", () => {
  assertEquals(parseCommand("!", "!"), null);
});

Deno.test("parseCommand: parses simple command", () => {
  const result = parseCommand("!ping", "!");
  assertEquals(result, { name: "ping", args: [], rawArgs: "" });
});

Deno.test("parseCommand: parses command with args", () => {
  const result = parseCommand("!echo hello world", "!");
  assertEquals(result, {
    name: "echo",
    args: ["hello", "world"],
    rawArgs: "hello world",
  });
});

Deno.test("parseCommand: lowercases command name", () => {
  const result = parseCommand("!PING", "!");
  assertEquals(result?.name, "ping");
});

Deno.test("parseCommand: handles multi-char prefix", () => {
  const result = parseCommand("bot:ping", "bot:");
  assertEquals(result, { name: "ping", args: [], rawArgs: "" });
});

Deno.test("parseCommand: trims whitespace", () => {
  const result = parseCommand("!  echo   hello   world  ", "!");
  assertEquals(result?.name, "echo");
  assertEquals(result?.args, ["hello", "world"]);
  assertEquals(result?.rawArgs, "hello   world");
});

Deno.test("parseCommand: returns null for empty prefix match", () => {
  assertEquals(parseCommand("!   ", "!"), null);
});
