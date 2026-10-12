FROM oven/bun:1.2
WORKDIR /app
COPY notes-mcp/package.json ./notes-mcp/
COPY mcp-servers ./mcp-servers
WORKDIR /app/notes-mcp
RUN bun install
COPY notes-mcp/src ./src
EXPOSE 4003
CMD ["bun", "run", "src/index.ts"]
