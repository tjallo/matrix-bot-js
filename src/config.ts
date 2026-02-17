import { join } from "@std/path";

export type BotLogLevel = "debug" | "info" | "warn" | "error";

export type BotConfig = {
  homeserverUrl: string;
  accessToken: string;
  userId: string;
  deviceId?: string;
  prefix: string;
  dataDir: string;
  matrixStatePath: string;
  botStorePath: string;
  cryptoDir: string;
  logLevel: BotLogLevel;
};

function getRequiredEnv(env: Deno.Env, key: string): string {
  const value = env.get(key);
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function getOptionalEnv(env: Deno.Env, key: string, fallback: string): string {
  return env.get(key) ?? fallback;
}

function parseLogLevel(value: string): BotLogLevel {
  const normalized = value.toLowerCase();
  if (
    normalized === "debug" ||
    normalized === "info" ||
    normalized === "warn" ||
    normalized === "error"
  ) {
    return normalized;
  }
  return "info";
}

export function loadConfig(env: Deno.Env = Deno.env): BotConfig {
  const homeserverUrl = getRequiredEnv(env, "MATRIX_HOMESERVER_URL");
  const accessToken = getRequiredEnv(env, "MATRIX_ACCESS_TOKEN");
  const userId = getRequiredEnv(env, "MATRIX_USER_ID");

  const prefix = getOptionalEnv(env, "BOT_PREFIX", "!");
  const dataDir = getOptionalEnv(env, "BOT_DATA_DIR", "./data");
  const matrixStatePath = getOptionalEnv(
    env,
    "MATRIX_STATE_PATH",
    join(dataDir, "matrix-bot.json"),
  );
  const botStorePath = getOptionalEnv(
    env,
    "BOT_STORE_PATH",
    join(dataDir, "bot-store.json"),
  );
  const cryptoDir = getOptionalEnv(
    env,
    "BOT_CRYPTO_DIR",
    join(dataDir, "crypto"),
  );
  const logLevel = parseLogLevel(getOptionalEnv(env, "BOT_LOG_LEVEL", "info"));
  const deviceId = env.get("MATRIX_DEVICE_ID") ?? undefined;

  return {
    homeserverUrl,
    accessToken,
    userId,
    deviceId,
    prefix,
    dataDir,
    matrixStatePath,
    botStorePath,
    cryptoDir,
    logLevel,
  };
}
