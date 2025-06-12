import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
  spyOn,
  type Mock,
  mock,
} from "bun:test";
import * as mainModule from "~/main";
import type { ITool } from "~/types/ITool";
import request from "supertest";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as typesModule from "@modelcontextprotocol/sdk/types.js";

class MockServer {
  public setRequestHandler = jest.fn();
  public args: any[];
  constructor(...args: any[]) {
    this.args = args;
  }
}
mock.module("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: MockServer,
}));

describe("listToolsHandler", () => {
  let getToolsSyncSpy: Mock<any>;

  beforeEach(() => {
    getToolsSyncSpy = spyOn(mainModule.helper, "getToolsSync");
  });

  afterEach(() => {
    getToolsSyncSpy.mockRestore();
  });

  it("should return tool configurations from helper.getToolsSync", async () => {
    const toolConfig = {
      name: "tool1",
      description: "A sample tool",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    };

    const mockTool = { getToolConfig: () => toolConfig };
    getToolsSyncSpy.mockImplementation(() => new Map([["tool1", mockTool]]));
    const result = await mainModule.listToolsHandler();
    expect(result).toEqual({ tools: [toolConfig] });
  });
});

describe("callToolHandler", () => {
  let getToolsSyncSpy: Mock<any>;
  let errorSpy: Mock<any>;

  beforeEach(() => {
    getToolsSyncSpy = spyOn(mainModule.helper, "getToolsSync");
    errorSpy = spyOn(mainModule.logger, "error");
  });

  afterEach(() => {
    getToolsSyncSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("should call tool.handleRequest and return its result when valid tool and arguments provided", async () => {
    const args = { foo: "bar" };
    const expectedResponse = {
      content: [{ type: "text", text: "tool response" }],
    };
    const handleRequest = jest.fn(async () => expectedResponse);
    const mockTool = { handleRequest };
    getToolsSyncSpy.mockImplementation(() => new Map([["tool1", mockTool]]));

    const request = { params: { name: "tool1", arguments: args } };
    const result = await mainModule.callToolHandler(request);
    expect(handleRequest).toHaveBeenCalledWith({ params: args });
    expect(result).toEqual(expectedResponse);
  });

  it("should throw an error and log when the tool is not found in the Map", async () => {
    getToolsSyncSpy.mockImplementation(() => new Map());
    const request = {
      params: { name: "nonExistentTool", arguments: { x: 1 } },
    };

    await expect(mainModule.callToolHandler(request)).rejects.toThrow(
      `Tool "nonExistentTool" not found or no arguments provided.`,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      `Tool "nonExistentTool" not found or no arguments provided.`,
    );
  });

  it("should throw an error if the tool exists in the Map but is undefined", async () => {
    getToolsSyncSpy.mockImplementation(() => new Map([["tool1", undefined]]));

    const request = { params: { name: "tool1", arguments: { x: 1 } } };
    await expect(mainModule.callToolHandler(request)).rejects.toThrow(
      `Tool "tool1" not instantiated.`,
    );
    expect(errorSpy).toHaveBeenCalledWith(`Tool "tool1" not instantiated.`);
  });

  it("should throw an error and log when arguments are not provided", async () => {
    const mockTool = { handleRequest: () => {} };
    getToolsSyncSpy.mockImplementation(() => new Map([["tool1", mockTool]]));
    const request = { params: { name: "tool1" } };
    await expect(mainModule.callToolHandler(request)).rejects.toThrow(
      `Tool "tool1" not found or no arguments provided.`,
    );
    expect(errorSpy).toHaveBeenCalledWith(
      `Tool "tool1" not found or no arguments provided.`,
    );
  });
});

describe("createServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("constructs Server with correct name and version from env", () => {
    process.env.APP_NAME = "test-server";
    const server = mainModule.createServer();
    expect(server).toBeInstanceOf(MockServer);
    expect((server as any).args[0]).toMatchObject({
      name: "test-server",
      version: "1.0.0",
    });
    expect((server as any).args[1]).toMatchObject({
      capabilities: { resources: {}, tools: {} },
    });
    expect(server.setRequestHandler).toHaveBeenCalledWith(
      ListToolsRequestSchema,
      mainModule.listToolsHandler,
    );
    expect(server.setRequestHandler).toHaveBeenCalledWith(
      CallToolRequestSchema,
      mainModule.callToolHandler,
    );
  });

  it("constructs Server with default name if APP_NAME is not set", () => {
    delete process.env.APP_NAME;
    const server = mainModule.createServer();
    expect(server).toBeInstanceOf(MockServer);
    expect((server as any).args[0]).toMatchObject({
      name: "mcp-server",
      version: "1.0.0",
    });
    expect(server.setRequestHandler).toHaveBeenCalledWith(
      ListToolsRequestSchema,
      mainModule.listToolsHandler,
    );
    expect(server.setRequestHandler).toHaveBeenCalledWith(
      CallToolRequestSchema,
      mainModule.callToolHandler,
    );
  });
});

describe("MCP Express API", () => {
  let app: ReturnType<typeof mainModule.createExpressApp>;
  let createServerSpy: Mock<any>;
  let connectSpy: Mock<any>;
  let mockServerInstance: any;

  beforeEach(() => {
    app = mainModule.createExpressApp();
    mockServerInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
    };
    createServerSpy = spyOn(mainModule, "createServer").mockReturnValue(
      mockServerInstance,
    );
    connectSpy = mockServerInstance.connect;
  });

  it("returns 400 for missing session ID on GET /mcp", async () => {
    const res = await request(app).get("/mcp");
    expect(res.status).toBe(400);
    expect(res.text).toContain("Invalid or missing session ID");
  });

  it("returns 400 for missing session ID on DELETE /mcp", async () => {
    const res = await request(app).delete("/mcp");
    expect(res.status).toBe(400);
    expect(res.text).toContain("Invalid or missing session ID");
  });

  it("returns 400 for bad POST /mcp request", async () => {
    const res = await request(app).post("/mcp").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain("Bad Request");
  });

  // Add more tests for POST, DELETE, etc.

  it("init", async () => {
    spyOn(typesModule, "isInitializeRequest").mockReturnValue(true);

    const res = await request(app).post("/mcp").send({ init: true });
    expect(res.status).not.toBe(400);
    expect(createServerSpy).toHaveBeenCalled();
    expect(connectSpy).toHaveBeenCalled();
  });
});

describe("runStreamableHttpServer", () => {
  let createExpressAppSpy: Mock<any>;
  let loggerInfoSpy: Mock<any>;
  let getToolsSyncSpy: Mock<any>;
  let appMock: any;

  beforeEach(() => {
    appMock = {
      listen: jest.fn((port, cb) => cb && cb()),
    };
    createExpressAppSpy = spyOn(mainModule, "createExpressApp").mockReturnValue(
      appMock,
    );
    loggerInfoSpy = spyOn(mainModule.logger, "info").mockImplementation(
      () => {},
    );
    getToolsSyncSpy = spyOn(mainModule.helper, "getToolsSync").mockReturnValue(
      new Map([["tool1", {} as unknown as ITool]]),
    );
  });

  afterEach(() => {
    createExpressAppSpy.mockRestore();
    loggerInfoSpy.mockRestore();
    getToolsSyncSpy.mockRestore();
  });

  it("creates app, listens, and logs info", async () => {
    await mainModule.runStreamableHttpServer();
    expect(createExpressAppSpy).toHaveBeenCalled();
    expect(appMock.listen).toHaveBeenCalled();
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      { tools: ["tool1"] },
      expect.stringContaining("Streaming MCP Server running on port"),
    );
  });
});

describe("runStdioServer", () => {
  let createServerSpy: Mock<any>;
  let connectSpy: Mock<any>;
  let loggerInfoSpy: Mock<any>;
  let getToolsSyncSpy: Mock<any>;
  let mockServerInstance: any;

  beforeEach(() => {
    mockServerInstance = {
      connect: jest.fn().mockResolvedValue(undefined),
    };
    createServerSpy = spyOn(mainModule, "createServer").mockReturnValue(
      mockServerInstance,
    );
    connectSpy = mockServerInstance.connect;
    loggerInfoSpy = spyOn(mainModule.logger, "info").mockImplementation(
      () => {},
    );
    getToolsSyncSpy = spyOn(mainModule.helper, "getToolsSync").mockReturnValue(
      new Map([["tool1", {} as unknown as ITool]]),
    );
  });

  afterEach(() => {
    createServerSpy.mockRestore();
    loggerInfoSpy.mockRestore();
    getToolsSyncSpy.mockRestore();
  });

  it("calls createServer, connects with StdioServerTransport, and logs info", async () => {
    await mainModule.runStdioServer();
    expect(createServerSpy).toHaveBeenCalled();
    expect(connectSpy).toHaveBeenCalled();
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      { tools: ["tool1"] },
      "MCP Server running on stdio with tools:",
    );
  });
});

describe("main", () => {
  let runStreamableHttpServerSpy: Mock<any>;
  let runStdioServerSpy: Mock<any>;
  const originalArgv = [...Bun.argv];

  beforeEach(() => {
    runStreamableHttpServerSpy = spyOn(
      mainModule,
      "runStreamableHttpServer",
    ).mockResolvedValue(undefined as any);
    runStdioServerSpy = spyOn(mainModule, "runStdioServer").mockResolvedValue(
      undefined as any,
    );
  });

  afterEach(() => {
    runStreamableHttpServerSpy.mockRestore();
    runStdioServerSpy.mockRestore();
    // Remove any arguments added during the test to restore Bun.argv
    while (Bun.argv.length > originalArgv.length) {
      Bun.argv.pop();
    }
  });

  it("calls runStreamableHttpServer if env.TRANSPORT_MODE is 'stream'", async () => {
    await mainModule.main({ TRANSPORT_MODE: "stream" });
    expect(runStreamableHttpServerSpy).toHaveBeenCalled();
    expect(runStdioServerSpy).not.toHaveBeenCalled();
  });

  it("calls runStreamableHttpServer if Bun.argv includes '--stream'", async () => {
    Bun.argv.push("--stream");
    await mainModule.main({});
    expect(runStreamableHttpServerSpy).toHaveBeenCalled();
    expect(runStdioServerSpy).not.toHaveBeenCalled();
  });

  it("calls runStdioServer otherwise", async () => {
    await mainModule.main({});
    expect(runStdioServerSpy).toHaveBeenCalled();
    expect(runStreamableHttpServerSpy).not.toHaveBeenCalled();
  });
});

describe("runServer", () => {
  let mainSpy: Mock<any>;
  let loggerErrorSpy: Mock<any>;
  let processExitSpy: Mock<any>;

  beforeEach(() => {
    mainSpy = spyOn(mainModule, "main").mockResolvedValue(undefined as any);
    loggerErrorSpy = spyOn(mainModule.logger, "error").mockImplementation(
      () => {},
    );
    processExitSpy = spyOn(process, "exit").mockImplementation(((
      code?: number,
    ) => {
      throw new Error("process.exit: " + code);
    }) as any);
  });

  afterEach(() => {
    mainSpy.mockRestore();
    loggerErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("calls main and does not exit on success", async () => {
    await mainModule.runServer();
    expect(mainSpy).toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it("logs error and exits if main throws", async () => {
    mainSpy.mockRejectedValue(new Error("fail!"));
    await expect(mainModule.runServer()).rejects.toThrow("process.exit: 1");
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      "Fatal error while running server:",
      expect.any(Error),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

describe("startServer", () => {
  it("should call runServer when isMain is true", () => {
    const runServerSpy = spyOn(
      require("~/main"),
      "runServer",
    ).mockImplementation(() => Promise.resolve());

    mainModule.startServer(true);

    expect(runServerSpy).toHaveBeenCalled();

    runServerSpy.mockRestore();
  });

  it("should not call runServer when isMain is false", () => {
    const runServerSpy = spyOn(
      require("~/main"),
      "runServer",
    ).mockImplementation(() => {});

    mainModule.startServer(false);

    expect(runServerSpy).not.toHaveBeenCalled();

    runServerSpy.mockRestore();
  });

  it("should not call runServer when isMain is not defined", () => {
    const runServerSpy = spyOn(
      require("~/main"),
      "runServer",
    ).mockImplementation(() => {});

    mainModule.startServer(false);

    expect(runServerSpy).not.toHaveBeenCalled();

    runServerSpy.mockRestore();
  });
});
