FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY server/package.json server/bun.lock ./
COPY server/prisma ./prisma
COPY server/prisma.config.ts ./
RUN bun install --frozen-lockfile && bunx prisma generate

FROM oven/bun:1.2 AS runtime
WORKDIR /app
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates openssl \
  && curl -fsSL https://get.helm.sh/helm-v3.16.4-linux-amd64.tar.gz | tar xz -C /tmp \
  && mv /tmp/linux-amd64/helm /usr/local/bin/helm \
  && curl -fsSLo /usr/local/bin/kubectl "https://dl.k8s.io/release/v1.31.4/bin/linux/amd64/kubectl" \
  && chmod +x /usr/local/bin/kubectl \
  && rm -rf /var/lib/apt/lists/* /tmp/linux-amd64
ENV NODE_ENV=production
COPY server/ .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY charts/store /charts/store
COPY wordpress/init-store.sh /charts/store/files/init-store.sh
RUN chmod +x /app/entrypoint.sh \
  && chown -R bun:bun /app /charts
EXPOSE 4000
USER bun
CMD ["/app/entrypoint.sh"]
