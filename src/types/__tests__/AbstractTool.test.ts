import { test as it, expect, describe, afterEach } from "bun:test";
import { AbstractTool } from "../AbstractTool";
import { ToolValidationError } from "../../errors/ToolValidationError";

describe("AbstractTool direct calls", () => {
  it("direct calls to abstract methods throw errors", () => {
    const tool = new AbstractTool();
    expect(() => tool.getName()).toThrowError(
      "Method 'getName()' must be implemented.",
    );
    expect(() => tool.getDescription()).toThrowError(
      "Method 'getDescription()' must be implemented.",
    );
    expect(() => tool.getInputSchema()).toThrowError(
      "Method 'getInputSchema()' must be implemented.",
    );
    expect(() => tool.validateWithDefaults({})).toThrowError(
      "Method 'validateWithDefaults(params)' must be implemented.",
    );
    expect(() => tool.processToolWorkflow({})).toThrowError(
      "Method 'processToolWorkflow(params)' must be implemented.",
    );
  });
});

describe("AbstractTool basic", () => {
  class TestTool extends AbstractTool {
    getName(): string {
      return "TestTool";
    }

    getDescription(): string {
      return "A test implementation of AbstractTool.";
    }

    getInputSchema() {
      return {
        type: "object",
        properties: { foo: { type: "string" } },
        required: ["foo"],
      };
    }

    validateWithDefaults(params: Record<string, any>): Record<string, any> {
      return params;
    }

    async processToolWorkflow(
      params: Record<string, any>,
    ): Promise<{ content: { type: string; text: string }[] }> {
      return {
        content: [{ type: "text", text: `Processed foo: ${params.foo}` }],
      };
    }
  }

  it("getToolConfig returns the proper configuration", () => {
    const tool = new TestTool();
    const config = tool.getToolConfig();
    expect(config).toEqual({
      name: "TestTool",
      description: "A test implementation of AbstractTool.",
      inputSchema: {
        type: "object",
        properties: { foo: { type: "string" } },
        required: ["foo"],
      },
    });
  });

  it("handleRequest successfully processes a valid request", async () => {
    const tool = new TestTool();
    const request = { params: { foo: "bar" } };
    const response = await tool.handleRequest(request);
    expect(response).toEqual({
      content: [{ type: "text", text: "Processed foo: bar" }],
    });
  });

  class TestToolValidationError extends TestTool {
    validateWithDefaults(params: Record<string, any>): Record<string, any> {
      throw new ToolValidationError("Invalid input");
    }
  }

  it("handleRequest catches ToolValidationError and returns an error message", async () => {
    const tool = new TestToolValidationError();
    const request = { params: { foo: "bar" } };
    const response = await tool.handleRequest(request);
    expect(response).toEqual({
      content: [{ type: "text", text: "Invalid input" }],
    });
  });

  class TestToolOtherError extends TestTool {
    validateWithDefaults(params: Record<string, any>): Record<string, any> {
      throw new Error("Something went wrong");
    }
  }

  it("handleRequest propagates non-ToolValidationError errors thrown synchronously", () => {
    const tool = new TestToolOtherError();
    const request = { params: { foo: "bar" } };
    expect(() => tool.handleRequest(request)).toThrow("Something went wrong");
  });
});

describe("AbstractTool.getUserAgentHeaderText", () => {
  const originalAppName = process.env.APP_NAME;
  const originalAppEmail = process.env.APP_EMAIL;

  class TestTool extends AbstractTool {
    getName() {
      return "test";
    }
    getDescription() {
      return "desc";
    }
    getInputSchema() {
      return { type: "object", properties: {}, required: [] };
    }
    validateWithDefaults(params: Record<string, any>) {
      return params;
    }
    async processToolWorkflow(params: Record<string, any>) {
      return { content: [] };
    }
  }

  afterEach(() => {
    process.env.APP_NAME = originalAppName;
    process.env.APP_EMAIL = originalAppEmail;
  });

  it("returns correct user agent when both env vars are set", () => {
    process.env.APP_NAME = "my-app";
    process.env.APP_EMAIL = "me@email.com";
    const tool = new TestTool();
    expect(tool.getUserAgentHeaderText()).toBe("my-app (me@email.com)");
  });

  it("throws if APP_NAME is missing", () => {
    delete process.env.APP_NAME;
    process.env.APP_EMAIL = "me@email.com";
    const tool = new TestTool();
    expect(() => tool.getUserAgentHeaderText()).toThrow(
      "Environment variables APP_NAME and APP_EMAIL must be set to generate User-Agent header.",
    );
  });

  it("throws if APP_EMAIL is missing", () => {
    process.env.APP_NAME = "my-app";
    delete process.env.APP_EMAIL;
    const tool = new TestTool();
    expect(() => tool.getUserAgentHeaderText()).toThrow(
      "Environment variables APP_NAME and APP_EMAIL must be set to generate User-Agent header.",
    );
  });

  it("throws if both APP_NAME and APP_EMAIL are missing", () => {
    delete process.env.APP_NAME;
    delete process.env.APP_EMAIL;
    const tool = new TestTool();
    expect(() => tool.getUserAgentHeaderText()).toThrow(
      "Environment variables APP_NAME and APP_EMAIL must be set to generate User-Agent header.",
    );
  });
});
