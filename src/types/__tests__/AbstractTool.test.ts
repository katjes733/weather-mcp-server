import { test, expect } from "bun:test";
import { AbstractTool } from "../AbstractTool";
import { ToolValidationError } from "../../errors/ToolValidationError";

test("direct calls to abstract methods throw errors", () => {
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

test("getToolConfig returns the proper configuration", () => {
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

test("handleRequest successfully processes a valid request", async () => {
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

test("handleRequest catches ToolValidationError and returns an error message", async () => {
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

test("handleRequest propagates non-ToolValidationError errors thrown synchronously", () => {
  const tool = new TestToolOtherError();
  const request = { params: { foo: "bar" } };
  expect(() => tool.handleRequest(request)).toThrow("Something went wrong");
});
