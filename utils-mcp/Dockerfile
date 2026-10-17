FROM oven/bun:1.2
WORKDIR /app
COPY utils-mcp/package.json ./utils-mcp/
COPY mcp-servers ./mcp-servers
WORKDIR /app/utils-mcp
RUN bun install \
  # mcp-servers/shared imports deps too; resolve them from this server's node_modules
  && ln -s /app/utils-mcp/node_modules /app/node_modules
COPY utils-mcp/src ./src
EXPOSE 4002
USER bun
CMD ["bun", "run", "src/index.ts"]
