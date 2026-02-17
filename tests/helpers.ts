import type { MatrixClientLike } from "../src/matrix/types.ts";
import type { Storage } from "../src/storage/storage.ts";
import type { BotConfig } from "../src/config.ts";

// ---------------------------------------------------------------------------
// Mock Matrix client
// ---------------------------------------------------------------------------

export type SentMessage = { roomId: string; text: string };

export class MockMatrixClient implements MatrixClientLike {
  sent: SentMessage[] = [];
  roomStateEvents: Map<string, Record<string, unknown>> = new Map();
  roomState: Map<string, Record<string, unknown>[]> = new Map();

  sendText(roomId: string, text: string): Promise<string> {
    this.sent.push({ roomId, text });
    return Promise.resolve(`$fake_event_${this.sent.length}`);
  }

  getRoomStateEvent(
    roomId: string,
    eventType: string,
    _stateKey: string,
  ): Promise<Record<string, unknown>> {
    const key = `${roomId}::${eventType}`;
    const event = this.roomStateEvents.get(key);
    if (!event) return Promise.reject(new Error(`State event not found: ${key}`));
    return Promise.resolve(event);
  }

  getRoomState(roomId: string): Promise<Record<string, unknown>[]> {
    return Promise.resolve(this.roomState.get(roomId) ?? []);
  }

  lastSentText(): string | undefined {
    return this.sent.at(-1)?.text;
  }
}

// ---------------------------------------------------------------------------
// In-memory storage (no filesystem)
// ---------------------------------------------------------------------------

export class MemoryStorage implements Storage {
  data: Map<string, unknown> = new Map();

  get<T>(key: string): Promise<T | undefined> {
    return Promise.resolve(this.data.get(key) as T | undefined);
  }

  set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
    return Promise.resolve();
  }

  update<T>(
    key: string,
    updater: (current: T) => T,
    defaultValue: T,
  ): Promise<T> {
    const current = (this.data.get(key) as T | undefined) ?? defaultValue;
    const next = updater(current);
    this.data.set(key, next);
    return Promise.resolve(next);
  }

  flush(): Promise<void> {
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Default test config
// ---------------------------------------------------------------------------

export function testConfig(overrides?: Partial<BotConfig>): BotConfig {
  return {
    homeserverUrl: "https://matrix.test",
    accessToken: "test_token",
    userId: "@bot:matrix.test",
    prefix: "!",
    dataDir: "./test-data",
    matrixStatePath: "./test-data/matrix-bot.json",
    botStorePath: "./test-data/bot-store.json",
    cryptoDir: "./test-data/crypto",
    logLevel: "error",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helper to build a fake Matrix message event
// ---------------------------------------------------------------------------

export function makeTextEvent(
  sender: string,
  body: string,
  extras?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: "m.room.message",
    sender,
    event_id: `$test_${Date.now()}`,
    origin_server_ts: Date.now(),
    content: {
      msgtype: "m.text",
      body,
    },
    ...extras,
  };
}
