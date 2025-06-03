import { it, expect } from "bun:test";
import { ToolValidationError } from "~/errors/ToolValidationError";

it("sets message and name correctly", () => {
  const errorMessage = "Test error message";
  const error = new ToolValidationError(errorMessage);

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(ToolValidationError);

  expect(error.message).toBe(errorMessage);
  expect(error.name).toBe("ToolValidationError");
});

it("sets the correct prototype chain", () => {
  const error = new ToolValidationError("Another test error");

  expect(Object.getPrototypeOf(error)).toBe(ToolValidationError.prototype);
});
