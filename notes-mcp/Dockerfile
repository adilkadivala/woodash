FROM oven/bun:1.2
WORKDIR /app
COPY notes-mcp/package.json ./notes-mcp/
COPY mcp-servers ./mcp-servers
WORKDIR /app/notes-mcp
RUN bun install \
  # mcp-servers/shared imports deps too; resolve them from this server's node_modules
  && ln -s /app/notes-mcp/node_modules /app/node_modules
COPY notes-mcp/src ./src
EXPOSE 4003
USER bun
CMD ["bun", "run", "src/index.ts"]
