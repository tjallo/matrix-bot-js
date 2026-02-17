import { assertEquals, assertExists } from "@std/assert";
import { join } from "@std/path";
import { JsonFileStorage } from "../../src/storage/json_file_storage.ts";

async function withTempStorage(
  fn: (storage: JsonFileStorage, path: string) => Promise<void>,
): Promise<void> {
  const tmpDir = await Deno.makeTempDir({ prefix: "bot_test_" });
  const filePath = join(tmpDir, "store.json");
  try {
    const storage = await JsonFileStorage.create(filePath);
    await fn(storage, filePath);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
}

Deno.test("JsonFileStorage: get returns undefined for missing key", async () => {
  await withTempStorage(async (storage) => {
    assertEquals(await storage.get("missing"), undefined);
  });
});

Deno.test("JsonFileStorage: set and get round-trip", async () => {
  await withTempStorage(async (storage) => {
    await storage.set("foo", { bar: 42 });
    assertEquals(await storage.get("foo"), { bar: 42 });
  });
});

Deno.test("JsonFileStorage: persists to disk", async () => {
  await withTempStorage(async (_storage, filePath) => {
    const s1 = await JsonFileStorage.create(filePath);
    await s1.set("key", "value");

    // Re-open from disk
    const s2 = await JsonFileStorage.create(filePath);
    assertEquals(await s2.get("key"), "value");
  });
});

Deno.test("JsonFileStorage: update with default value", async () => {
  await withTempStorage(async (storage) => {
    const result = await storage.update<number>(
      "counter",
      (n) => n + 1,
      0,
    );
    assertEquals(result, 1);
    assertEquals(await storage.get("counter"), 1);
  });
});

Deno.test("JsonFileStorage: update existing value", async () => {
  await withTempStorage(async (storage) => {
    await storage.set("counter", 5);
    const result = await storage.update<number>(
      "counter",
      (n) => n + 1,
      0,
    );
    assertEquals(result, 6);
  });
});

Deno.test("JsonFileStorage: flush is idempotent when not dirty", async () => {
  await withTempStorage(async (storage) => {
    await storage.flush(); // should be no-op
    assertEquals(await storage.get("anything"), undefined);
  });
});

Deno.test("JsonFileStorage: creates parent directories", async () => {
  const tmpDir = await Deno.makeTempDir({ prefix: "bot_test_" });
  const deepPath = join(tmpDir, "a", "b", "c", "store.json");
  try {
    const storage = await JsonFileStorage.create(deepPath);
    assertExists(storage);
    await storage.set("deep", true);
    assertEquals(await storage.get("deep"), true);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});
