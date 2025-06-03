import { describe, it, expect, beforeEach, jest, afterEach } from "bun:test";
import { ZipcodeToGeocode } from "../ZipcodeToGeocode";
import dedent from "dedent";

const mockFetch = jest.fn();

function createInstance() {
  const instance = new ZipcodeToGeocode(
    mockFetch as unknown as typeof globalThis.fetch,
  );
  return instance;
}

describe("ZipcodeToGeocode", () => {
  const originalAppName = process.env.APP_NAME;
  const originalAppEmail = process.env.APP_EMAIL;

  const expectedName = "zipcode-to-geocode";
  const expectedDescription = dedent`
    Convert a US ZIP code to geographic coordinates (latitude and longitude).
    System Prompt:
    - Always ask the user for the 'zipcode' parameter if it is not provided. Avoid inferring or making up values.
    - If the parameter is not a valid ZIP code, ask the user to provide a valid ZIP code.
    Parameters:
    - 'zipcode': a valid US ZIP code. If not provided, it will be requested from the user.
  `;
  const expectedInputSchema = {
    type: "object",
    properties: {
      zipcode: { type: "string" },
    },
    required: ["zipcode"],
  };

  beforeEach(() => {
    process.env.APP_NAME = "weather-mcp-server";
    process.env.APP_EMAIL = "some.email@net.com";
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env.APP_NAME = originalAppName;
    process.env.APP_EMAIL = originalAppEmail;
  });

  it("getName returns correct name", () => {
    const tool = createInstance();
    expect(tool.getName()).toBe(expectedName);
  });

  it("getDescription returns a string", () => {
    const tool = createInstance();
    expect(typeof tool.getDescription()).toBe("string");
    expect(tool.getDescription()).toBe(expectedDescription);
  });

  it("getInputSchema returns correct schema", () => {
    const tool = createInstance();
    const schema = tool.getInputSchema();
    expect(schema).toEqual(expectedInputSchema);
  });

  it("validateWithDefaults accepts valid zipcodes", () => {
    const tool = createInstance();
    expect(tool.validateWithDefaults({ zipcode: "12345" })).toEqual({
      zipcode: "12345",
    });
    expect(tool.validateWithDefaults({ zipcode: "12345-6789" })).toEqual({
      zipcode: "12345-6789",
    });
  });

  it("validateWithDefaults throws on invalid zipcodes", () => {
    const tool = createInstance();
    expect(() => tool.validateWithDefaults({ zipcode: 12345 })).toThrow(
      "Invalid US Zip code",
    );
    expect(() => tool.validateWithDefaults({ zipcode: "abcde" })).toThrow(
      "Invalid US Zip code",
    );
    expect(() => tool.validateWithDefaults({ zipcode: "1234" })).toThrow(
      "Invalid US Zip code",
    );
    expect(() => tool.validateWithDefaults({ zipcode: "" })).toThrow(
      "Invalid US Zip code",
    );
  });

  it("processToolWorkflow returns correct content for valid zipcode", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{ latitude: "40.1", longitude: "-75.2" }],
      }),
    });
    const result = await tool.processToolWorkflow({ zipcode: "12345" });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Coordinates for ZIP code 12345: Latitude 40.1, Longitude -75.2.",
        },
      ],
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.zippopotam.us/us/12345",
    );
  });

  it("zipcodeToGeocode throws if fetch not ok", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({ ok: false });
    await expect(tool["zipcodeToGeocode"]("99999")).rejects.toThrow(
      "Failed to fetch data for zipcode 99999",
    );
  });

  it("zipcodeToGeocode returns lat/lon from API", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ places: [{ latitude: "12.3", longitude: "45.6" }] }),
    });
    const result = await tool["zipcodeToGeocode"]("90210");
    expect(result).toEqual({ latitude: "12.3", longitude: "45.6" });
  });

  it("zipcodeToGeocode throws if API returns no places property", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    await expect(tool["zipcodeToGeocode"]("00000")).rejects.toThrow();
  });

  it("zipcodeToGeocode throws if API returns empty places array", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    });
    await expect(tool["zipcodeToGeocode"]("00001")).rejects.toThrow();
  });

  it("zipcodeToGeocode returns undefined lat/lon if API returns place with missing lat/lon", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ places: [{}] }),
    });
    const result = await tool["zipcodeToGeocode"]("00002");
    // @ts-ignore
    expect(result).toEqual({ latitude: undefined, longitude: undefined });
  });

  it("zipcodeToGeocode throws if API returns places as a non-array", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ places: "not-an-array" }),
    });
    await expect(tool["zipcodeToGeocode"]("00003")).rejects.toThrow(
      "No places found for zipcode 00003",
    );
  });

  it("getToolConfig returns config", () => {
    const tool = createInstance();
    expect(tool.getToolConfig()).toEqual({
      name: expectedName,
      description: expectedDescription,
      inputSchema: expectedInputSchema,
    });
  });

  it("handleRequest returns processToolWorkflow result", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [{ latitude: "40.1", longitude: "-75.2" }],
      }),
    });
    const result = await tool.handleRequest({ params: { zipcode: "12345" } });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Coordinates for ZIP code 12345: Latitude 40.1, Longitude -75.2.",
        },
      ],
    });
  });

  it("handleRequest returns ToolValidationError message if thrown", async () => {
    const tool = new ZipcodeToGeocode();
    const result = await tool.handleRequest({ params: { zipcode: "1234" } });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'Invalid US Zip code "1234". Ask user for a valid US Zip code.',
        },
      ],
    });
  });

  it("handleRequest re-throws error other than ToolValidationError", async () => {
    class DummyError extends Error {}
    class ErrorTool extends ZipcodeToGeocode {
      validateWithDefaults(params: Record<string, any>): Record<string, any> {
        throw new DummyError("validation failed");
      }
    }
    const tool = new ErrorTool(mockFetch as unknown as typeof globalThis.fetch);
    try {
      await tool.handleRequest({ params: { zipcode: "1234" } });
    } catch (error) {
      expect(error).toBeInstanceOf(DummyError);
      // @ts-ignore
      expect(error.message).toBe("validation failed");
    }
  });
});
