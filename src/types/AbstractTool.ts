import type { ITool } from "./ITool";
import { ToolValidationError } from "../errors/ToolValidationError";

export class AbstractTool implements ITool {
  protected fetch: typeof globalThis.fetch;

  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetch;
  }

  getName(): string {
    throw new Error("Method 'getName()' must be implemented.");
  }

  getDescription(): string {
    throw new Error("Method 'getDescription()' must be implemented.");
  }

  getInputSchema(): {
    type: string;
    properties: Record<string, any>;
    required: string[];
  } {
    throw new Error("Method 'getInputSchema()' must be implemented.");
  }

  getToolConfig() {
    return {
      name: this.getName(),
      description: this.getDescription(),
      inputSchema: this.getInputSchema(),
    };
  }

  handleRequest(request: { params: Record<string, any> }): Promise<{
    content: {
      type: string;
      text: string;
      annotations?: Record<string, any>;
    }[];
  }> {
    try {
      return this.processToolWorkflow(
        this.validateWithDefaults(request.params),
      );
    } catch (error) {
      if (error instanceof ToolValidationError) {
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: error.message,
            },
          ],
        });
      }
      throw error;
    }
  }

  /* eslint-disable no-unused-vars */
  validateWithDefaults(params: Record<string, any>): Record<string, any> {
    throw new Error(
      "Method 'validateWithDefaults(params)' must be implemented.",
    );
  }

  async processToolWorkflow(params: Record<string, any>): Promise<{
    content: { type: string; text: string }[];
  }> {
    throw new Error(
      "Method 'processToolWorkflow(params)' must be implemented.",
    );
  }
  /* eslint-enable no-unused-vars */
}
