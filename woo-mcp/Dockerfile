FROM oven/bun:1.2
WORKDIR /app
COPY woo-mcp/package.json ./woo-mcp/
COPY mcp-servers ./mcp-servers
WORKDIR /app/woo-mcp
RUN bun install
COPY woo-mcp/src ./src
EXPOSE 4001
CMD ["bun", "run", "src/index.ts"]
