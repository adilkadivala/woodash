FROM oven/bun:1.2
WORKDIR /app
COPY woo-mcp/package.json ./woo-mcp/
COPY mcp-servers ./mcp-servers
WORKDIR /app/woo-mcp
RUN bun install \
  # mcp-servers/shared imports deps too; resolve them from this server's node_modules
  && ln -s /app/woo-mcp/node_modules /app/node_modules
COPY woo-mcp/src ./src
EXPOSE 4011
USER bun
CMD ["bun", "run", "src/index.ts"]
