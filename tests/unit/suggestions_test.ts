import { assertEquals } from "@std/assert";
import {
  addSuggestion,
  getSuggestions,
} from "../../src/services/suggestions.ts";
import { MemoryStorage } from "../helpers.ts";

Deno.test("getSuggestions: returns empty array when none exist", async () => {
  const storage = new MemoryStorage();
  const items = await getSuggestions(storage);
  assertEquals(items, []);
});

Deno.test("addSuggestion: creates a suggestion with auto-incrementing id", async () => {
  const storage = new MemoryStorage();
  const now = new Date("2025-06-15T12:00:00Z");

  const s1 = await addSuggestion(
    storage,
    "Add dark mode",
    "@alice:test",
    "!room:test",
    now,
  );
  assertEquals(s1.id, 1);
  assertEquals(s1.text, "Add dark mode");
  assertEquals(s1.sender, "@alice:test");
  assertEquals(s1.roomId, "!room:test");
  assertEquals(s1.createdAt, now.toISOString());

  const s2 = await addSuggestion(
    storage,
    "Add reminders",
    "@bob:test",
    "!room2:test",
    now,
  );
  assertEquals(s2.id, 2);
  assertEquals(s2.sender, "@bob:test");
});

Deno.test("getSuggestions: returns all suggestions in order", async () => {
  const storage = new MemoryStorage();
  const now = new Date("2025-06-15T12:00:00Z");

  await addSuggestion(storage, "First", "@alice:test", "!room:test", now);
  await addSuggestion(storage, "Second", "@bob:test", "!room:test", now);
  await addSuggestion(storage, "Third", "@alice:test", "!room:test", now);

  const items = await getSuggestions(storage);
  assertEquals(items.length, 3);
  assertEquals(items[0].text, "First");
  assertEquals(items[1].text, "Second");
  assertEquals(items[2].text, "Third");
});

Deno.test("addSuggestion: tracks sender per suggestion", async () => {
  const storage = new MemoryStorage();
  const now = new Date("2025-06-15T12:00:00Z");

  await addSuggestion(storage, "Idea A", "@alice:test", "!room:test", now);
  await addSuggestion(storage, "Idea B", "@bob:test", "!room:test", now);

  const items = await getSuggestions(storage);
  assertEquals(items[0].sender, "@alice:test");
  assertEquals(items[1].sender, "@bob:test");
});
