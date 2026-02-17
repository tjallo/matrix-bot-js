import type { Storage } from "../storage/storage.ts";

export type StatsSnapshot = {
  totalCommands: number;
  byCommand: Record<string, number>;
  lastCommandAt?: string;
};

const DEFAULT_STATS: StatsSnapshot = {
  totalCommands: 0,
  byCommand: {},
};

export async function recordCommand(
  storage: Storage,
  commandName: string,
  now: Date,
): Promise<StatsSnapshot> {
  return await storage.update<StatsSnapshot>(
    "stats",
    (current: StatsSnapshot) => {
      const next: StatsSnapshot = {
        totalCommands: current.totalCommands + 1,
        byCommand: { ...current.byCommand },
        lastCommandAt: now.toISOString(),
      };
      next.byCommand[commandName] =
        (next.byCommand[commandName] ?? 0) + 1;
      return next;
    },
    DEFAULT_STATS,
  );
}

export async function getStats(
  storage: Storage,
): Promise<StatsSnapshot> {
  return (await storage.get<StatsSnapshot>("stats")) ?? DEFAULT_STATS;
}
