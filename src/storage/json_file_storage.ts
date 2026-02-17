import { dirname } from "@std/path";
import { Storage } from "./storage.ts";

type JsonRecord = Record<string, unknown>;

async function ensureDir(path: string): Promise<void> {
  await Deno.mkdir(path, { recursive: true });
}

export class JsonFileStorage implements Storage {
  #filePath: string;
  #data: JsonRecord;
  #dirty = false;

  private constructor(filePath: string, data: JsonRecord) {
    this.#filePath = filePath;
    this.#data = data;
  }

  static async create(filePath: string): Promise<JsonFileStorage> {
    await ensureDir(dirname(filePath));
    try {
      const raw = await Deno.readTextFile(filePath);
      const data = JSON.parse(raw) as JsonRecord;
      return new JsonFileStorage(filePath, data ?? {});
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return new JsonFileStorage(filePath, {});
      }
      throw error;
    }
  }

  get<T>(key: string): Promise<T | undefined> {
    return Promise.resolve(this.#data[key] as T | undefined);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.#data[key] = value as unknown;
    this.#dirty = true;
    await this.flush();
  }

  async update<T>(
    key: string,
    updater: (current: T) => T,
    defaultValue: T,
  ): Promise<T> {
    const current = (this.#data[key] as T | undefined) ?? defaultValue;
    const next = updater(current);
    this.#data[key] = next as unknown;
    this.#dirty = true;
    await this.flush();
    return next;
  }

  async flush(): Promise<void> {
    if (!this.#dirty) return;
    const payload = JSON.stringify(this.#data, null, 2);
    await Deno.writeTextFile(this.#filePath, payload);
    this.#dirty = false;
  }
}
