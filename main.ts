import { loadConfig } from "./src/config.ts";
import { createMatrixClient } from "./src/matrix/client.ts";
import { JsonFileStorage } from "./src/storage/json_file_storage.ts";
import { createBot } from "./src/bot.ts";
import type { BotConfig } from "./src/config.ts";
import type { MatrixClient } from "matrix-bot-sdk";

/**
 * Detect whether an error is a one-time key conflict
 * (server already has a different key with the same ID).
 * This typically happens when the homeserver state and the
 * local crypto store diverge, e.g. after a Synapse reset.
 */
function isOtkConflict(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as Record<string, unknown>;
  return (
    e.errcode === "M_UNKNOWN" &&
    typeof e.error === "string" &&
    e.error.includes("already exists. Old key:")
  );
}

/**
 * Remove the local crypto store so the SDK generates fresh keys
 * on the next start.
 */
async function wipeCryptoStore(config: BotConfig): Promise<void> {
  console.warn(`Wiping crypto store at ${config.cryptoDir} ...`);
  try {
    await Deno.remove(config.cryptoDir, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  await Deno.mkdir(config.cryptoDir, { recursive: true });
  console.warn("Crypto store wiped.");
}

function wireEvents(
  client: MatrixClient,
  bot: ReturnType<typeof createBot>,
): void {
  // Encryption: room.message events arrive already decrypted by the SDK.
  // We also log encryption lifecycle events for observability.
  client.on("room.message", (roomId: string, event: Record<string, unknown>) => {
    bot.handleMessage(roomId, event);
  });

  client.on(
    "room.encrypted_event",
    (roomId: string, event: Record<string, unknown>) => {
      console.log(
        `[crypto] Encrypted event received in ${roomId}: ${event["event_id"]}`,
      );
    },
  );

  client.on(
    "room.failed_decryption",
    (roomId: string, event: Record<string, unknown>, error: Error) => {
      console.error(
        `[crypto] Failed to decrypt event in ${roomId}: ${event["event_id"]}`,
        error.message,
      );
    },
  );
}

async function main(): Promise<void> {
  const config = loadConfig();

  console.log(`Matrix Bot starting...`);
  console.log(`  Homeserver: ${config.homeserverUrl}`);
  console.log(`  User:       ${config.userId}`);
  console.log(`  Prefix:     ${config.prefix}`);
  console.log(`  Data dir:   ${config.dataDir}`);

  // Ensure data directory exists
  await Deno.mkdir(config.dataDir, { recursive: true });

  const storage = await JsonFileStorage.create(config.botStorePath);
  let client = createMatrixClient(config);
  let bot = createBot({ client, storage, config });

  wireEvents(client, bot);

  // Graceful shutdown
  const abort = () => {
    console.log("Shutting down...");
    client.stop();
    Deno.exit(0);
  };
  Deno.addSignalListener("SIGINT", abort);
  Deno.addSignalListener("SIGTERM", abort);

  try {
    await client.start();
  } catch (err) {
    if (!isOtkConflict(err)) throw err;

    console.warn(
      "One-time key conflict detected — local crypto store is out of sync with homeserver.",
    );
    await wipeCryptoStore(config);

    // Recreate client with a fresh crypto store and retry once.
    client = createMatrixClient(config);
    bot = createBot({ client, storage, config });
    wireEvents(client, bot);
    await client.start();
  }

  console.log("Bot started and syncing.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  Deno.exit(1);
});
