import express from "express";
import type { Express } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import createLogger from "./log";
import { Helper } from "./helper";
import { v4 as uuidv4 } from "uuid";

export const logger = createLogger();

export const helper = new Helper();
await helper.loadTools();

export const listToolsHandler = async () => {
  const tools = Array.from(helper.getToolsSync().values()).map((tool) =>
    tool.getToolConfig(),
  );
  return {
    tools,
  };
};

export const callToolHandler = async (request: {
  params: {
    name: string;
    arguments?: Record<string, any>;
  };
}) => {
  if (
    helper.getToolsSync().has(request.params.name) &&
    request.params.arguments !== undefined
  ) {
    const tool = helper.getToolsSync().get(request.params.name);
    if (!tool) {
      logger.error(`Tool "${request.params.name}" not instantiated.`);
      throw new Error(`Tool "${request.params.name}" not instantiated.`);
    }

    const { arguments: args } = request.params;
    return await tool.handleRequest({ params: args });
  }
  logger.error(
    `Tool "${request.params.name}" not found or no arguments provided.`,
  );
  throw new Error(
    `Tool "${request.params.name}" not found or no arguments provided.`,
  );
};

export function createServer() {
  const server = new Server(
    {
      name: process.env.APP_NAME || "mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    },
  );
  server.setRequestHandler(ListToolsRequestSchema, listToolsHandler);
  server.setRequestHandler(CallToolRequestSchema, callToolHandler);
  return server;
}

export function createExpressApp(): Express {
  const app = express();
  app.use(express.json());

  const transports: {
    [sessionId: string]: StreamableHTTPServerTransport;
  } = {};

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const eventStore = new InMemoryEventStore();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => uuidv4(),
        eventStore,
        onsessioninitialized: (sessionId) => {
          transports[sessionId] = transport;
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };

      await createServer().connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  });

  const handleSessionRequest = async (
    req: express.Request,
    res: express.Response,
  ) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };

  // Handle GET requests for server-to-client notifications via SSE
  app.get("/mcp", handleSessionRequest);

  // Handle DELETE requests for session termination
  app.delete("/mcp", handleSessionRequest);

  return app;
}

export async function runStreamableHttpServer() {
  const app = createExpressApp();
  const port = process.env.PORT || 3000;
  app.listen(port, () =>
    logger.info(
      { tools: [...helper.getToolsSync().keys()] },
      `Streaming MCP Server running on port ${port} 🚀 with tools:`,
    ),
  );
}

export async function runStdioServer() {
  const transport = new StdioServerTransport();
  await createServer().connect(transport);
  logger.info(
    { tools: [...helper.getToolsSync().keys()] },
    "MCP Server running on stdio with tools:",
  );
}

export async function main(env = Bun.env) {
  if (env.TRANSPORT_MODE === "stream" || Bun.argv.includes("--stream")) {
    runStreamableHttpServer();
  } else {
    runStdioServer();
  }
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
