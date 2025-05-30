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
  // eslint-disable-next-line no-unused-vars
  handleRequest(request: { params: Record<string, any> }): Promise<{
    content: { type: string; text: string }[];
  }>;
}
