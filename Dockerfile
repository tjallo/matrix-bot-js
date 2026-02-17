FROM denoland/deno:2.6.10

WORKDIR /app

# Copy dependency files first to leverage Docker cache
COPY deno.json deno.lock* ./

# Install deps and run native postinstall scripts (for crypto module)
RUN deno install --allow-scripts=npm:@matrix-org/matrix-sdk-crypto-nodejs@0.4.0

# Copy source code
COPY . .

# Type-check at build time
RUN deno check main.ts

# Persistent data volume for bot storage, Matrix state, and crypto keys
VOLUME /data

ENV BOT_DATA_DIR=/data

CMD ["deno", "run", "--allow-all", "--env-file", "main.ts"]
