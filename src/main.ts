import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import logger from "./log";
import { Helper } from "./helper";

const helper = new Helper();

const server = new Server(
  {
    name: "weather-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  },
);

export const listToolsHandler = async () => {
  const tools = Array.from((await helper.getTools()).values()).map((tool) =>
    tool.getToolConfig(),
  );
  return {
    tools,
  };
};

server.setRequestHandler(ListToolsRequestSchema, listToolsHandler);

export const callToolHandler = async (request: {
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}) => {
  if (
    (await helper.getTools()).has(request.params.name) &&
    request.params.arguments !== undefined
  ) {
    const tool = (await helper.getTools()).get(request.params.name);
    if (!tool) {
      throw new Error("Tool not found");
    }

    const { arguments: args } = request.params;
    return await tool.handleRequest({ params: args });
  }
  logger.error(
    `Tool "${request.params.name}" not found or no arguments provided.`,
  );
  throw new Error(`Tool "${request.params.name}" not found`);
};

server.setRequestHandler(CallToolRequestSchema, callToolHandler);

export async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(
    { tools: [...(await helper.getTools()).keys()] },
    "MCP Server running on stdio with tools:",
  );
}

export async function runServer() {
  try {
    await main();
  } catch (error) {
    logger.error("Fatal error while running server:", error);
    process.exit(1);
  }
}

export function startServer(isMain = import.meta.main) {
  if (isMain) {
    runServer();
  }
}

startServer();
