import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  mock,
  jest,
  spyOn,
  type Mock,
} from "bun:test";
import * as mainModule from "../main";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

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
    const handleRequest = jest.fn(async ({ params }) => expectedResponse);
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

describe("main and runServer", () => {
  let connectSpy: Mock<any>;
  let infoSpy: Mock<any>;

  beforeEach(() => {
    connectSpy = spyOn(mainModule.server, "connect").mockResolvedValue(
      undefined,
    );
    infoSpy = spyOn(mainModule.logger, "info");
  });

  afterEach(() => {
    connectSpy.mockRestore();
    infoSpy.mockRestore();
  });

  it("main calls connect on transport and logs info", async () => {
    await mainModule.main();
    expect(connectSpy).toHaveBeenCalledWith(expect.any(StdioServerTransport));
    expect(infoSpy).toHaveBeenCalled();
  });

  it("runServer catches errors from main, logs them, and calls process.exit", async () => {
    connectSpy.mockRejectedValue(new Error("Connection failed"));
    const errorSpy = spyOn(mainModule.logger, "error");
    const exitSpy = spyOn(process, "exit").mockImplementation(
      (code?: number): never => {
        throw new Error("Exited with code " + code);
      },
    );
    await expect(mainModule.runServer()).rejects.toThrow("Exited with code");
    expect(errorSpy).toHaveBeenCalledWith(
      "Fatal error while running server:",
      new Error("Connection failed"),
    );
    exitSpy.mockRestore();
  });
});

describe("startServer", () => {
  it("should call runServer when isMain is true", () => {
    const runServerSpy = spyOn(
      require("../main"),
      "runServer",
    ).mockImplementation(() => Promise.resolve());

    mainModule.startServer(true);

    expect(runServerSpy).toHaveBeenCalled();

    runServerSpy.mockRestore();
  });

  it("should not call runServer when isMain is false", () => {
    const runServerSpy = spyOn(
      require("../main"),
      "runServer",
    ).mockImplementation(() => {});

    mainModule.startServer(false);

    expect(runServerSpy).not.toHaveBeenCalled();

    runServerSpy.mockRestore();
  });

  it("should not call runServer when isMain is not defined", () => {
    const runServerSpy = spyOn(
      require("../main"),
      "runServer",
    ).mockImplementation(() => {});

    mainModule.startServer(false);

    expect(runServerSpy).not.toHaveBeenCalled();

    runServerSpy.mockRestore();
  });
});
