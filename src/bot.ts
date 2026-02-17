import type { BotConfig } from "./config.ts";
import type { MatrixClientLike } from "./matrix/types.ts";
import type { Storage } from "./storage/storage.ts";
import { createCommandRegistry } from "./commands/handlers.ts";
import { parseCommand } from "./commands/parser.ts";
import { recordCommand } from "./services/stats.ts";

type BotDependencies = {
  client: MatrixClientLike;
  storage: Storage;
  config: BotConfig;
  startTime?: Date;
};

export type BotInstance = {
  registry: ReturnType<typeof createCommandRegistry>;
  startTime: Date;
  handleMessage: (roomId: string, event: Record<string, unknown>) => Promise<void>;
};

function isTextMessage(event: Record<string, unknown>): event is Record<string, unknown> {
  const content = event["content"] as Record<string, unknown> | undefined;
  return content?.["msgtype"] === "m.text" && typeof content?.["body"] === "string";
}

export function createBot(deps: BotDependencies): BotInstance {
  const registry = createCommandRegistry();
  const startTime = deps.startTime ?? new Date();

  const handleMessage = async (
    roomId: string,
    event: Record<string, unknown>,
  ): Promise<void> => {
    const sender = event["sender"];
    if (typeof sender !== "string") return;
    if (sender === deps.config.userId) return;
    if (!isTextMessage(event)) return;

    const content = event["content"] as Record<string, unknown>;
    const body = content["body"] as string;
    const parsed = parseCommand(body, deps.config.prefix);
    if (!parsed) return;

    const definition = registry.get(parsed.name);
    if (!definition) {
      await deps.client.sendText(
        roomId,
        `Unknown command: ${parsed.name}. Try ${deps.config.prefix}help`,
      );
      return;
    }

    const now = new Date();
    await recordCommand(deps.storage, parsed.name, now);

    try {
      await definition.handler({
        roomId,
        event,
        sender,
        args: parsed.args,
        rawArgs: parsed.rawArgs,
        config: deps.config,
        client: deps.client,
        storage: deps.storage,
        now,
        startTime,
        registry,
      });
    } catch (error) {
      console.error("Command handler error", error);
      await deps.client.sendText(
        roomId,
        "Something went wrong while running that command.",
      );
    }
  };

  return { registry, startTime, handleMessage };
}
