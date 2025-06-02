export class ToolValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolValidationError";

    Object.setPrototypeOf(this, ToolValidationError.prototype);
  }
}
