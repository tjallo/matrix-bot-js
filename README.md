# Matrix Bot (Deno)

An encrypted Matrix bot built with Deno and [matrix-bot-sdk](https://github.com/turt2live/matrix-bot-sdk). Supports E2EE out of the box.

## Prerequisites

- [Deno](https://deno.land/) 2.x
- A Matrix account for the bot on any homeserver (e.g. your own Synapse/Conduit, or a public server)

## Setup

### 1. Create a bot account

Register a new user on your homeserver. How you do this depends on your server:

**Synapse (admin API):**

```bash
register_new_matrix_user -c /path/to/homeserver.yaml http://localhost:8008
```

**Or register via the client API (if open registration is enabled):**

```bash
curl -X POST https://your-homeserver.org/_matrix/client/v3/register \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "mybot",
    "password": "a-strong-password",
    "auth": { "type": "m.login.dummy" }
  }'
```

### 2. Get an access token

Log in with the bot account to obtain an access token:

```bash
curl -X POST https://your-homeserver.org/_matrix/client/v3/login \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "m.login.password",
    "identifier": {
      "type": "m.id.user",
      "user": "mybot"
    },
    "password": "a-strong-password"
  }'
```

The response looks like:

```json
{
  "user_id": "@mybot:your-homeserver.org",
  "access_token": "syt_abc123...",
  "device_id": "SOMEDEVICEID",
  "home_server": "your-homeserver.org"
}
```

Save `access_token` and `user_id`. You can note `device_id` too, but the bot SDK will manage its own device ID in the crypto store automatically.

> **Important:** The access token is a secret. Do not commit it to version control.

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
MATRIX_HOMESERVER_URL=https://your-homeserver.org
MATRIX_ACCESS_TOKEN=syt_abc123...
MATRIX_USER_ID=@mybot:your-homeserver.org
```

#### All environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MATRIX_HOMESERVER_URL` | yes | | Homeserver URL the bot connects to |
| `MATRIX_ACCESS_TOKEN` | yes | | Access token from login |
| `MATRIX_USER_ID` | yes | | Full Matrix user ID (`@user:server`) |
| `MATRIX_DEVICE_ID` | no | (auto) | Managed by crypto store; rarely needed |
| `BOT_PREFIX` | no | `!` | Command prefix |
| `BOT_DATA_DIR` | no | `./data` | Directory for all persistent data |
| `BOT_LOG_LEVEL` | no | `info` | `debug`, `info`, `warn`, or `error` |

### 4. Invite the bot

Invite the bot user to a room. It will auto-join. The bot supports encrypted rooms natively -- messages are decrypted and encrypted transparently by the SDK.

## Running

```bash
# Development (auto-reload on changes)
deno task dev

# Production
deno task start
```

## Docker

```bash
docker build -t matrix-bot .

docker run -d \
  --name matrix-bot \
  -v $(pwd)/data:/data \
  --env-file .env \
  matrix-bot
```

The `/data` volume persists:
- `crypto/` -- E2EE device keys (SQLite). **Back this up.** If lost, you need a new access token.
- `matrix-bot.json` -- SDK sync state.
- `bot-store.json` -- Bot data (command stats, settings).

## Commands

Default prefix: `!`

| Command | Description |
|---|---|
| `!help [command]` | List commands or get help for one |
| `!ping` | Health check |
| `!echo <text>` | Echo text back |
| `!time` | Server time (ISO 8601) |
| `!uptime` | Bot uptime |
| `!roll [NdM]` | Dice roll (default 1d6, max 100d1000) |
| `!whoami` | Shows caller and bot user info |
| `!roominfo` | Room name, ID, member count, encryption status |
| `!encryptstatus` | Whether room encryption is enabled |
| `!stats` | Command usage statistics |
| `!version` | Deno/V8/TypeScript versions |

## Encryption

Encryption is enabled automatically via `RustSdkCryptoStorageProvider`. The bot:

- Decrypts incoming messages transparently
- Encrypts outgoing messages in encrypted rooms
- Logs failed decryption events for debugging
- Persists crypto keys in `data/crypto/`

**You do not need a recovery key.** Recovery keys are a user-facing feature for recovering message history across devices. A bot only needs to process new messages, so preserving the `data/` directory between restarts is sufficient.

### If encryption breaks

If you lose the `data/crypto/` directory or the access token becomes invalid:

1. Log in again (step 2 above) to get a new access token
2. Delete `data/crypto/` so the SDK creates a fresh crypto store
3. Update `MATRIX_ACCESS_TOKEN` in `.env`
4. Restart the bot

Other users may need to re-verify the bot device in their clients.

## Testing

```bash
# All tests (61 tests)
deno task test

# By category
deno task test:unit          # Parser, formatting, storage, stats, registry
deno task test:feature       # Command handlers with mocked client
deno task test:integration   # Full message-to-response flow
```

All tests use mocked clients and in-memory storage -- no homeserver needed.

## Project Structure

```
├── main.ts                       # Entrypoint
├── src/
│   ├── config.ts                 # Env config parsing
│   ├── bot.ts                    # Bot core (dispatch, error handling)
│   ├── matrix/
│   │   ├── client.ts             # Matrix SDK client factory + encryption
│   │   └── types.ts              # MatrixClientLike interface
│   ├── commands/
│   │   ├── handlers.ts           # Command implementations
│   │   ├── parser.ts             # Prefix parser
│   │   ├── registry.ts           # Command registry
│   │   └── types.ts              # Command types
│   ├── services/
│   │   ├── format.ts             # Duration formatting
│   │   └── stats.ts              # Usage stats
│   └── storage/
│       ├── storage.ts            # Storage interface
│       └── json_file_storage.ts  # JSON file implementation
├── tests/
│   ├── helpers.ts                # Mocks and fixtures
│   ├── unit/                     # Pure function tests
│   ├── feature/                  # Handler tests
│   └── integration/              # End-to-end flow tests
├── Dockerfile
├── .env.example
└── deno.json
```
