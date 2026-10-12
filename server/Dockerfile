FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.2 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4000
USER bun
CMD ["bun", "run", "src/index.ts"]
