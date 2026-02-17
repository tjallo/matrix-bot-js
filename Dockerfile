FROM denoland/deno:2.1.4

WORKDIR /app

# Copy dependency files first to leverage Docker cache
COPY deno.json deno.lock* ./

# Cache dependencies
RUN deno install

# Copy source code
COPY . .

# Type-check at build time
RUN deno check main.ts

# Persistent data volume for bot storage, Matrix state, and crypto keys
VOLUME /data

ENV BOT_DATA_DIR=/data

EXPOSE 8080

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "main.ts"]
