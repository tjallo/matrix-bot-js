import { assertEquals } from "@std/assert";
import { CommandRegistry } from "../../src/commands/registry.ts";

Deno.test("CommandRegistry: register and get", () => {
  const registry = new CommandRegistry();
  registry.register({
    name: "test",
    summary: "A test command",
    handler: async () => {},
  });

  const def = registry.get("test");
  assertEquals(def?.name, "test");
  assertEquals(def?.summary, "A test command");
});

Deno.test("CommandRegistry: get returns undefined for unknown command", () => {
  const registry = new CommandRegistry();
  assertEquals(registry.get("nope"), undefined);
});

Deno.test("CommandRegistry: list returns sorted commands", () => {
  const registry = new CommandRegistry();
  registry.register({
    name: "zebra",
    summary: "Z command",
    handler: async () => {},
  });
  registry.register({
    name: "alpha",
    summary: "A command",
    handler: async () => {},
  });

  const list = registry.list();
  assertEquals(list.length, 2);
  assertEquals(list[0].name, "alpha");
  assertEquals(list[1].name, "zebra");
});
