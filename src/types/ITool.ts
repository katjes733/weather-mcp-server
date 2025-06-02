export interface ITool {
  getName(): string;
  getDescription(): string;
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
  validateWithDefaults(params: Record<string, any>): Record<string, any>;
  handleRequest(request: { params: Record<string, any> }): Promise<{
    content: { type: string; text: string }[];
  }>;
  /* eslint-enable no-unused-vars */
}
