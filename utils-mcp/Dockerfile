FROM oven/bun:1.2
WORKDIR /app
COPY utils-mcp/package.json ./utils-mcp/
COPY mcp-servers ./mcp-servers
WORKDIR /app/utils-mcp
RUN bun install
COPY utils-mcp/src ./src
EXPOSE 4002
CMD ["bun", "run", "src/index.ts"]
