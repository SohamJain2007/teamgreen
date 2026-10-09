# SafaiRanchi production image (Railway). SQLite + photos live on a mounted volume at /data.
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Toolchain in case a native module (better-sqlite3) has no prebuilt binary for this platform.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Inlined into client code at build time, so it must be present here (Railway passes service variables as build args).
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev \
  # onnxruntime-node ships binaries for every OS and CPU (~550 MB); keep only this one.
  && rm -rf node_modules/onnxruntime-node/bin/napi-v*/darwin node_modules/onnxruntime-node/bin/napi-v*/win32 \
  && for d in node_modules/onnxruntime-node/bin/napi-v*/linux/*; do [ "$(basename "$d")" = "$(node -p process.arch)" ] || rm -rf "$d"; done

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 \
    DATABASE_PATH=/data/safai.db UPLOAD_DIR=/data/uploads
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/data ./data
COPY --from=build /app/ml/model ./ml/model
COPY --from=build /app/next.config.mjs ./
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]
