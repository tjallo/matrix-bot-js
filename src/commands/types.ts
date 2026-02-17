import type { BotConfig } from "../config.ts";
import type { Storage } from "../storage/storage.ts";
import type { MatrixClientLike } from "../matrix/types.ts";
import type { CommandRegistry } from "./registry.ts";

export type CommandHandler = (ctx: CommandContext) => Promise<void>;

export type CommandDefinition = {
  name: string;
  summary: string;
  usage?: string;
  handler: CommandHandler;
};

export type CommandContext = {
  roomId: string;
  event: Record<string, unknown>;
  sender: string;
  args: string[];
  rawArgs: string;
  config: BotConfig;
  client: MatrixClientLike;
  storage: Storage;
  now: Date;
  startTime: Date;
  registry: CommandRegistry;
};
