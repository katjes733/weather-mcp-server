import { describe, it, expect, beforeEach, jest } from "bun:test";
import { GridPointUrl } from "../GridPointUrl";
import dedent from "dedent";

const mockFetch = jest.fn();

function createInstance() {
  const instance = new GridPointUrl(
    mockFetch as unknown as typeof globalThis.fetch,
  );
  return instance;
}

describe("GridPointUrl", () => {
  const expectedName = "get-grid-point-url";
  const expectedDescription = dedent`
    Generate a URL for a specific grid point using latitude and longitude. This URL can be used to access weather data for that grid point.
    System Prompt:
    - Always ask the user for the 'latitude' and 'longitude' parameters if they are not provided. Avoid inferring or making up values.
    - If the parameters are not valid coordinates, ask the user to provide valid latitude and longitude values.
    Parameters:
    - 'latitude': a valid latitude coordinate (between -90 and 90).
    - 'longitude': a valid longitude coordinate (between -180 and 180).
  `;
  const expectedInputSchema = {
    type: "object",
    properties: {
      latitude: { type: "number" },
      longitude: { type: "number" },
    },
    required: ["latitude", "longitude"],
  };

  beforeEach(() => {
    mockFetch.mockReset();
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

  it("validateWithDefaults accepts valid coordinates", () => {
    const tool = createInstance();
    expect(tool.validateWithDefaults({ latitude: -10, longitude: 0 })).toEqual({
      latitude: -10,
      longitude: 0,
    });
    expect(
      tool.validateWithDefaults({ latitude: -90, longitude: 180 }),
    ).toEqual({ latitude: -90, longitude: 180 });
  });

  it("validateWithDefaults throws on invalid coordinates", () => {
    const tool = createInstance();
    expect(() =>
      tool.validateWithDefaults({ latitude: -91, longitude: 180 }),
    ).toThrow("Invalid coordinates");
    expect(() =>
      tool.validateWithDefaults({ latitude: -90, longitude: 181 }),
    ).toThrow("Invalid coordinates");
    expect(() =>
      tool.validateWithDefaults({ latitude: "-6", longitude: 180 }),
    ).toThrow("Invalid coordinates");
    expect(() =>
      tool.validateWithDefaults({ latitude: -6, longitude: "" }),
    ).toThrow("Invalid coordinates");
  });

  it("processToolWorkflow returns correct content for valid coordinates", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          forecastGridData: "https://api.weather.gov/gridpoints/XYZ/0,0",
        },
      }),
    });
    const result = await tool.processToolWorkflow({
      latitude: 0,
      longitude: 0,
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "URL to access weather data for grid point at Latitude 0, Longitude 0: https://api.weather.gov/gridpoints/XYZ/0,0",
        },
      ],
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.weather.gov/points/0,0",
      expect.objectContaining({
        headers: expect.any(Object),
      }),
    );
  });

  it("getGridPointUrl throws if fetch not ok", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(tool["getGridPointUrl"](0, 0)).rejects.toThrow(
      "Error fetching point data: 500",
    );
  });

  it("getGridPointUrl returns URL from API", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          forecastGridData: "https://api.weather.gov/gridpoints/XYZ/0,0",
        },
      }),
    });
    const result = await tool["getGridPointUrl"](0, 0);
    expect(result).toEqual({
      gridPointUrl: "https://api.weather.gov/gridpoints/XYZ/0,0",
    });
  });

  it("getGridPointUrl throws if API returns no properties property", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    await expect(tool["getGridPointUrl"](0, 0)).rejects.toThrow();
  });

  it("getGridPointUrl returns undefined forecastGridData", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ properties: {} }),
    });
    const result = await tool["getGridPointUrl"](0, 0);
    // @ts-ignore
    expect(result).toEqual({ forecastGridData: undefined });
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
        properties: {
          forecastGridData: "https://api.weather.gov/gridpoints/XYZ/0,0",
        },
      }),
    });
    const result = await tool.handleRequest({
      params: { latitude: 0, longitude: 0 },
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "URL to access weather data for grid point at Latitude 0, Longitude 0: https://api.weather.gov/gridpoints/XYZ/0,0",
        },
      ],
    });
  });

  it("handleRequest returns ToolValidationError message if thrown", async () => {
    const tool = new GridPointUrl();
    const result = await tool.handleRequest({
      params: { latitude: 91, longitude: 56 },
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Invalid coordinates: Latitude 91, Longitude 56. Ask user for valid coordinates.",
        },
      ],
    });
  });

  it("handleRequest re-throws error other than ToolValidationError", async () => {
    class DummyError extends Error {}
    class ErrorTool extends GridPointUrl {
      validateWithDefaults(params: Record<string, any>): Record<string, any> {
        throw new DummyError("validation failed");
      }
    }
    const tool = new ErrorTool(mockFetch as unknown as typeof globalThis.fetch);
    try {
      await tool.handleRequest({ params: { latitude: 89, longitude: 56 } });
    } catch (error) {
      expect(error).toBeInstanceOf(DummyError);
      // @ts-ignore
      expect(error.message).toBe("validation failed");
    }
  });
});
