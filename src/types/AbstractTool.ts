import type { ITool } from "./ITool";
import { ToolValidationError } from "~/errors/ToolValidationError";

/**
 * Abstract class for tools that implements the ITool interface.
 *
 * Provides default implementations for methods that can be overridden by subclasses.
 */
export class AbstractTool implements ITool {
  protected fetch: typeof globalThis.fetch;

  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetch;
  }

  // Subclasses should override this method
  getName(): string {
    throw new Error("Method 'getName()' must be implemented.");
  }

  // Subclasses should override this method
  getDescription(): string {
    throw new Error("Method 'getDescription()' must be implemented.");
  }

  // Subclasses should override this method
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

  /**
   * Generates a User-Agent header text using environment variables.
   * Throws an error if environment variables APP_NAME or APP_EMAIL are not set.
   */
  getUserAgentHeaderText(): string {
    if (!process.env.APP_NAME || !process.env.APP_EMAIL) {
      throw new Error(
        "Environment variables APP_NAME and APP_EMAIL must be set to generate User-Agent header.",
      );
    }
    return `${process.env.APP_NAME} (${process.env.APP_EMAIL})`;
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
  // Subclasses should override this method
  validateWithDefaults(params: Record<string, any>): Record<string, any> {
    throw new Error(
      "Method 'validateWithDefaults(params)' must be implemented.",
    );
  }

  // Subclasses should override this method
  async processToolWorkflow(params: Record<string, any>): Promise<{
    content: { type: string; text: string }[];
  }> {
    throw new Error(
      "Method 'processToolWorkflow(params)' must be implemented.",
    );
  }
  /* eslint-enable no-unused-vars */
}
