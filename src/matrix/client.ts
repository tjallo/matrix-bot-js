import {
  AutojoinRoomsMixin,
  LogLevel,
  LogService,
  MatrixClient,
  RustSdkCryptoStorageProvider,
  SimpleFsStorageProvider,
} from "matrix-bot-sdk";
import type { BotConfig, BotLogLevel } from "../config.ts";

// RustSdkCryptoStoreType.Sqlite = 0, but it's a const enum so we use the
// literal value to avoid "Cannot access ambient const enums" with isolatedModules.
const SQLITE_STORE_TYPE = 0 as const;

function toSdkLogLevel(level: BotLogLevel): LogLevel {
  switch (level) {
    case "debug":
      return LogLevel.DEBUG;
    case "info":
      return LogLevel.INFO;
    case "warn":
      return LogLevel.WARN;
    case "error":
      return LogLevel.ERROR;
  }
}

export function createMatrixClient(config: BotConfig): MatrixClient {
  LogService.setLevel(toSdkLogLevel(config.logLevel));
  const storageProvider = new SimpleFsStorageProvider(config.matrixStatePath);
  const cryptoProvider = new RustSdkCryptoStorageProvider(
    config.cryptoDir,
    SQLITE_STORE_TYPE,
  );
  const client = new MatrixClient(
    config.homeserverUrl,
    config.accessToken,
    storageProvider,
    cryptoProvider,
  );
  AutojoinRoomsMixin.setupOnClient(client);
  return client;
}
