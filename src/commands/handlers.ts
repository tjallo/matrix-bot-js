import { CommandRegistry } from "./registry.ts";
import type { CommandContext } from "./types.ts";
import { formatDurationMs } from "../services/format.ts";
import { getStats } from "../services/stats.ts";

type DiceSpec = {
  count: number;
  sides: number;
};

const MAX_DICE = 100;
const MAX_SIDES = 1000;

function parseDiceSpec(input: string | undefined): DiceSpec | null {
  if (!input) return { count: 1, sides: 6 };
  const match = input.toLowerCase().match(/^(\d+)d(\d+)$/);
  if (!match) return null;
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (!Number.isFinite(count) || !Number.isFinite(sides)) return null;
  if (count < 1 || sides < 2) return null;
  if (count > MAX_DICE || sides > MAX_SIDES) return null;
  return { count, sides };
}

async function isRoomEncrypted(ctx: CommandContext): Promise<boolean> {
  try {
    const event = await ctx.client.getRoomStateEvent(
      ctx.roomId,
      "m.room.encryption",
      "",
    );
    return Boolean(event?.["algorithm"]);
  } catch {
    return false;
  }
}

export function createCommandRegistry(): CommandRegistry {
  const registry = new CommandRegistry();

  registry.register({
    name: "help",
    summary: "List commands or get help for one",
    usage: "help [command]",
    handler: async (ctx: CommandContext) => {
      const query = ctx.args[0]?.toLowerCase();
      if (query) {
        const def = ctx.registry.get(query);
        if (!def) {
          await ctx.client.sendText(
            ctx.roomId,
            `Unknown command: ${query}. Try ${ctx.config.prefix}help`,
          );
          return;
        }
        const usage = def.usage
          ? `${ctx.config.prefix}${def.usage}`
          : `${ctx.config.prefix}${def.name}`;
        await ctx.client.sendText(
          ctx.roomId,
          `${def.summary}\nUsage: ${usage}`,
        );
        return;
      }

      const lines = ctx.registry.list().map((def: { name: string; summary: string }) =>
        `${ctx.config.prefix}${def.name} - ${def.summary}`
      );
      await ctx.client.sendText(
        ctx.roomId,
        `Commands:\n${lines.join("\n")}`,
      );
    },
  });

  registry.register({
    name: "ping",
    summary: "Check bot responsiveness",
    handler: async (ctx: CommandContext) => {
      await ctx.client.sendText(ctx.roomId, "Pong!");
    },
  });

  registry.register({
    name: "echo",
    summary: "Echo back text",
    usage: "echo <text>",
    handler: async (ctx: CommandContext) => {
      if (!ctx.rawArgs) {
        await ctx.client.sendText(
          ctx.roomId,
          `Usage: ${ctx.config.prefix}echo <text>`,
        );
        return;
      }
      await ctx.client.sendText(ctx.roomId, ctx.rawArgs);
    },
  });

  registry.register({
    name: "time",
    summary: "Show server time",
    handler: async (ctx: CommandContext) => {
      await ctx.client.sendText(
        ctx.roomId,
        `Server time: ${ctx.now.toISOString()}`,
      );
    },
  });

  registry.register({
    name: "uptime",
    summary: "Show bot uptime",
    handler: async (ctx: CommandContext) => {
      const uptime = formatDurationMs(ctx.now.getTime() - ctx.startTime.getTime());
      await ctx.client.sendText(ctx.roomId, `Uptime: ${uptime}`);
    },
  });

  registry.register({
    name: "roll",
    summary: "Roll dice (NdM)",
    usage: "roll [NdM]",
    handler: async (ctx: CommandContext) => {
      const spec = parseDiceSpec(ctx.args[0]);
      if (!spec) {
        await ctx.client.sendText(
          ctx.roomId,
          `Usage: ${ctx.config.prefix}roll [NdM] (max ${MAX_DICE}d${MAX_SIDES})`,
        );
        return;
      }
      const rolls = Array.from({ length: spec.count }, () =>
        1 + Math.floor(Math.random() * spec.sides)
      );
      const total = rolls.reduce((sum, value) => sum + value, 0);
      await ctx.client.sendText(
        ctx.roomId,
        `Rolled ${spec.count}d${spec.sides}: ${rolls.join(", ")} (total ${total})`,
      );
    },
  });

  registry.register({
    name: "whoami",
    summary: "Show your Matrix user ID",
    handler: async (ctx: CommandContext) => {
      const device = ctx.config.deviceId
        ? `Device ID: ${ctx.config.deviceId}`
        : "Device ID: (not configured)";
      await ctx.client.sendText(
        ctx.roomId,
        `You are ${ctx.sender}\nBot user: ${ctx.config.userId}\n${device}`,
      );
    },
  });

  registry.register({
    name: "roominfo",
    summary: "Show room name and member count",
    handler: async (ctx: CommandContext) => {
      let roomName = "(unknown)";
      try {
        const nameEvent = await ctx.client.getRoomStateEvent(
          ctx.roomId,
          "m.room.name",
          "",
        );
        if (typeof nameEvent?.["name"] === "string") {
          roomName = nameEvent["name"] as string;
        }
      } catch {
        roomName = "(unavailable)";
      }

      let memberCount: number | null = null;
      try {
        const state = await ctx.client.getRoomState(ctx.roomId);
        memberCount = state.filter((event: Record<string, unknown>) => {
          const type = event["type"];
          const content = event["content"] as Record<string, unknown> | undefined;
          return type === "m.room.member" && content?.["membership"] === "join";
        }).length;
      } catch {
        memberCount = null;
      }

      const encrypted = await isRoomEncrypted(ctx);
      const memberText = memberCount === null
        ? "Members: (unavailable)"
        : `Members: ${memberCount}`;
      await ctx.client.sendText(
        ctx.roomId,
        `Room: ${roomName}\nRoom ID: ${ctx.roomId}\n${memberText}\nEncrypted: ${encrypted ? "yes" : "no"}`,
      );
    },
  });

  registry.register({
    name: "encryptstatus",
    summary: "Check if room encryption is enabled",
    handler: async (ctx: CommandContext) => {
      const encrypted = await isRoomEncrypted(ctx);
      await ctx.client.sendText(
        ctx.roomId,
        `Encryption: ${encrypted ? "enabled" : "disabled"}`,
      );
    },
  });

  registry.register({
    name: "stats",
    summary: "Show command usage stats",
    handler: async (ctx: CommandContext) => {
      const stats = await getStats(ctx.storage);
      const top = (Object.entries(stats.byCommand) as Array<[string, number]>)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => `${name}: ${count}`)
        .join(", ");
      await ctx.client.sendText(
        ctx.roomId,
        `Commands run: ${stats.totalCommands}\nLast command: ${stats.lastCommandAt ?? "n/a"}\nTop: ${top || "n/a"}`,
      );
    },
  });

  registry.register({
    name: "version",
    summary: "Show runtime versions",
    handler: async (ctx: CommandContext) => {
      await ctx.client.sendText(
        ctx.roomId,
        `Deno: ${Deno.version.deno}\nV8: ${Deno.version.v8}\nTypeScript: ${Deno.version.typescript}`,
      );
    },
  });

  return registry;
}
