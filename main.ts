import { loadConfig } from "./src/config.ts";
import { createMatrixClient } from "./src/matrix/client.ts";
import { JsonFileStorage } from "./src/storage/json_file_storage.ts";
import { createBot } from "./src/bot.ts";

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
  const client = createMatrixClient(config);

  const bot = createBot({ client, storage, config });

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

  // Graceful shutdown
  const abort = () => {
    console.log("Shutting down...");
    client.stop();
    Deno.exit(0);
  };
  Deno.addSignalListener("SIGINT", abort);
  Deno.addSignalListener("SIGTERM", abort);

  await client.start();
  console.log("Bot started and syncing.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  Deno.exit(1);
});
