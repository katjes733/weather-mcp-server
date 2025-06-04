/**
 * Common interface for a MCP tool that can be used in a MCP System.
 * All tools should implement this interface to ensure they provide the necessary methods and properties.
 * This interface defines the contract for tools, including methods for getting the tool's name, description, input schema, and handling requests.
 *
 * @file ITool.ts
 */
export interface ITool {
  /**
   * Get the name of the tool.
   */
  getName(): string;

  /**
   * Get a description of the tool.
   * Should contain:
   *   - Details about what the tool does and how it can be used.
   *   - System prompt
   *   - Parameters that the tool accepts.
   */
  getDescription(): string;

  /**
   * Get the input schema for the tool.
   * Should be a JSON Schema object that describes the parameters the tool accepts.
   * The schema should include:
   *   - Type of the object (should be "object").
   *   - Properties of the object, where each property is described by its name and type.
   *   - Required properties that must be provided when using the tool.
   */
  getInputSchema(): {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };

  /**
   * Get the input schema for the tool.
   * Should be a JSON Schema object that describes the tool and the parameters the tool accepts.
   */
  getToolConfig(): {
    name: string;
    description: string;
    inputSchema: {
      type: string;
      properties: Record<string, { type: string }>;
      required: string[];
    };
  };

  /* eslint-disable no-unused-vars */
  /**
   * Validate the parameters with defaults.
   * This method should ensure that the parameters are valid and return them in a normalized format.
   * It also ensures that reasonable defaults are applied to the parameters.
   * If the parameters are invalid, it should throw a `ToolValidationError` with a message asking the user to provide valid parameters.
   *
   * @param params - The parameters to validate and normalize.
   */
  validateWithDefaults(params: Record<string, any>): Record<string, any>;

  /**
   * Handles the request to the tool.
   * This method should process the request and return the result.
   * It should call `validateWithDefaults` to ensure the parameters are valid before processing.
   *
   * @param request - The request object containing parameters to process.
   */
  handleRequest(request: { params: Record<string, any> }): Promise<{
    content: {
      type: string;
      text: string;
      annotations?: Record<string, any>;
    }[];
  }>;

  /**
   * Process the tool workflow with the validated parameters.
   * This method should implement the core logic of the tool and return the result.
   * It is called by `handleRequest` after validating the parameters.
   *
   * @param params - The validated parameters to process.
   */
  processToolWorkflow(params: Record<string, any>): Promise<{
    content: { type: string; text: string }[];
  }>;
  /* eslint-enable no-unused-vars */
}
