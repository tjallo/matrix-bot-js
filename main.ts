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
 * Try to delete the current device from the server so Synapse forgets
 * its stale one-time keys. We try the Synapse admin API first (no UIA
 * required), then fall back to the client API with empty auth.
 *
 * Returns true if the device was successfully deleted, false otherwise.
 */
async function deleteDeviceOnServer(
  client: MatrixClient,
  userId: string,
): Promise<boolean> {
  let deviceId: string | undefined;
  try {
    const whoami = await client.getWhoAmI();
    deviceId = whoami.device_id;
  } catch {
    console.warn("Could not determine device ID from /whoami, skipping device deletion.");
    return false;
  }
  if (!deviceId) return false;

  console.warn(`Attempting to delete device ${deviceId} from server...`);

  // Try Synapse admin API first (works when the bot user is a server admin).
  try {
    await client.doRequest(
      "DELETE",
      `/_synapse/admin/v2/users/${encodeURIComponent(userId)}/devices/${encodeURIComponent(deviceId)}`,
    );
    console.warn(`Device ${deviceId} deleted via Synapse admin API.`);
    return true;
  } catch {
    console.warn("Synapse admin API device deletion failed, trying client API...");
  }

  // Fall back to the client API with empty auth body (works on some setups).
  try {
    await client.doRequest(
      "DELETE",
      `/_matrix/client/v3/devices/${encodeURIComponent(deviceId)}`,
      null,
      { auth: {} },
    );
    console.warn(`Device ${deviceId} deleted via client API.`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove all local state (crypto store + Matrix sync state) so the SDK
 * registers a fresh device with new keys on the next start.
 */
async function wipeLocalState(config: BotConfig): Promise<void> {
  console.warn("Wiping local state (crypto store + matrix state)...");

  // Wipe crypto store directory
  try {
    await Deno.remove(config.cryptoDir, { recursive: true });
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  await Deno.mkdir(config.cryptoDir, { recursive: true });

  // Wipe matrix SDK state file so the cached device ID is forgotten
  try {
    await Deno.remove(config.matrixStatePath);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }

  console.warn("Local state wiped.");
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

    // Try to delete the stale device from the server so its old keys are
    // purged, then wipe all local state and retry with a fresh device.
    const deleted = await deleteDeviceOnServer(client, config.userId);

    if (!deleted) {
      // We cannot recover automatically — the device's stale keys are stuck
      // on the server and the access token is permanently bound to this
      // device ID.  Print actionable instructions and exit cleanly so
      // Docker does not endlessly restart the container.
      console.error(
        "\n" +
        "=== MANUAL INTERVENTION REQUIRED ===\n" +
        "The server has stale encryption keys for this device that the bot cannot delete.\n" +
        "The access token is bound to this device ID, so wiping local state alone will not help.\n" +
        "\n" +
        "Fix this with ONE of the following:\n" +
        "\n" +
        "  1. Delete the device via the Synapse admin API (from a server-admin account):\n" +
        "     curl -X DELETE \\\n" +
        `       '${config.homeserverUrl}/_synapse/admin/v2/users/${encodeURIComponent(config.userId)}/devices/NPNQESXJNZ' \\\n` +
        "       -H 'Authorization: Bearer <ADMIN_TOKEN>'\n" +
        "\n" +
        "  2. Log in again to get a new access token (with a fresh device ID)\n" +
        "     and update MATRIX_ACCESS_TOKEN in your .env file.\n" +
        "\n" +
        "  3. Make the bot user a Synapse server admin so it can self-heal.\n" +
        "=== END ===\n",
      );
      Deno.exit(1);
    }

    await wipeLocalState(config);

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
