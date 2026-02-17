import { assertEquals } from "@std/assert";
import { recordCommand, getStats } from "../../src/services/stats.ts";
import { MemoryStorage } from "../helpers.ts";

Deno.test("getStats: returns defaults when empty", async () => {
  const storage = new MemoryStorage();
  const stats = await getStats(storage);
  assertEquals(stats, { totalCommands: 0, byCommand: {} });
});

Deno.test("recordCommand: increments total and per-command counts", async () => {
  const storage = new MemoryStorage();
  const now = new Date("2025-01-01T00:00:00Z");

  await recordCommand(storage, "ping", now);
  await recordCommand(storage, "ping", now);
  await recordCommand(storage, "help", now);

  const stats = await getStats(storage);
  assertEquals(stats.totalCommands, 3);
  assertEquals(stats.byCommand["ping"], 2);
  assertEquals(stats.byCommand["help"], 1);
  assertEquals(stats.lastCommandAt, now.toISOString());
});

Deno.test("recordCommand: updates lastCommandAt", async () => {
  const storage = new MemoryStorage();
  const t1 = new Date("2025-01-01T00:00:00Z");
  const t2 = new Date("2025-06-15T12:00:00Z");

  await recordCommand(storage, "ping", t1);
  let stats = await getStats(storage);
  assertEquals(stats.lastCommandAt, t1.toISOString());

  await recordCommand(storage, "ping", t2);
  stats = await getStats(storage);
  assertEquals(stats.lastCommandAt, t2.toISOString());
});
