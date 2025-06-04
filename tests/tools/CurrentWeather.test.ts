import { describe, it, expect, beforeEach, jest, afterEach } from "bun:test";
import { CurrentWeather } from "~/tools/CurrentWeather";
import dedent from "dedent";

const mockFetch = jest.fn();

function createInstance() {
  const instance = new CurrentWeather(
    mockFetch as unknown as typeof globalThis.fetch,
  );
  return instance;
}

describe("CurrentWeather", () => {
  const originalAppName = process.env.APP_NAME;
  const originalAppEmail = process.env.APP_EMAIL;

  const expectedName = "current-weather";
  const expectedDescription = dedent`
      Get the current weather for a specific location using a grid point URL.
      System Prompt:
      - Always ask the user for the 'gridPointUrl' parameter if it is not provided. Avoid inferring or making up values.
      - If the parameter is not a valid grid point URL, ask the user to provide a valid grid point URL.
      - Use 'daily-forecast-weather' tool if user wants the weather forecast instead of the current weather.
      - Use 'hourly-forecast-weather' tool if user wants the hourly (explicitly stated) forecast instead of the current weather.
      Parameters:
      - 'gridPointUrl': a valid grid point URL from the National Weather Service API. If not provided, it will be requested from the user.
    `;
  const expectedInputSchema = {
    type: "object",
    properties: {
      gridPointUrl: { type: "string" },
    },
    required: ["gridPointUrl"],
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

  it("validateWithDefaults accepts valid gridPointUrl", () => {
    const tool = createInstance();
    expect(
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/PSR/171,48",
      }),
    ).toEqual({
      gridPointUrl: "https://api.weather.gov/gridpoints/PSR/171,48",
    });
    expect(
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/KEY/14,23",
      }),
    ).toEqual({
      gridPointUrl: "https://api.weather.gov/gridpoints/KEY/14,23",
    });
  });

  it("validateWithDefaults throws on invalid gridPointUrl", () => {
    const tool = createInstance();
    expect(() => tool.validateWithDefaults({ gridPointUrl: 12345 })).toThrow(
      "Invalid grid point URL",
    );
    expect(() =>
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/pSr/171,48",
      }),
    ).toThrow("Invalid grid point URL");
    expect(() =>
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/PSRX/171,48",
      }),
    ).toThrow("Invalid grid point URL");
    expect(() =>
      tool.validateWithDefaults({
        gridPointUrl: "https://ap.weather.gov/gridpoints/PSR/171,48",
      }),
    ).toThrow("Invalid grid point URL");
    expect(() =>
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/PSR/171,-48",
      }),
    ).toThrow("Invalid grid point URL");
    expect(() => tool.validateWithDefaults({ gridPointUrl: "" })).toThrow(
      "Invalid grid point URL",
    );
  });

  it("processToolWorkflow returns correct content for valid gridPointUrl", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              stationIdentifier: "KCHD",
            },
          },
        ],
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          temperature: {
            unitCode: "wmoUnit:degC",
            value: 30,
            qualityControl: "V",
          },
          windSpeed: {
            unitCode: "wmoUnit:km_h-1",
            value: 5,
            qualityControl: "V",
          },
          windDirection: {
            unitCode: "wmoUnit:degree_(angle)",
            value: 225,
            qualityControl: "V",
          },
          visibility: {
            unitCode: "wmoUnit:m",
            value: 16090,
            qualityControl: "C",
          },
          precipitationLastHour: {
            unitCode: "wmoUnit:mm",
            value: null,
            qualityControl: "Z",
          },
          relativeHumidity: {
            unitCode: "wmoUnit:percent",
            value: 40.172842074825,
            qualityControl: "V",
          },
          textDescription: "Mostly Clear",
          timestamp: "2025-06-03T16:47:00+00:00",
        },
      }),
    });
    const result = await tool.processToolWorkflow({
      gridPointUrl: "https://api.weather.gov/gridpoints/PSR/171,48",
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            temperature: {
              value: 30,
              unit: "wmoUnit:degC",
            },
            windSpeed: {
              value: 5,
              unit: "wmoUnit:km_h-1",
            },
            windDirection: {
              value: 225,
              unit: "wmoUnit:degree_(angle)",
            },
            visibility: {
              value: 16090,
              unit: "wmoUnit:m",
            },
            precipitationLastHour: {
              value: 0,
              unit: "wmoUnit:mm",
            },
            relativeHumidity: {
              value: 40.172842074825,
              unit: "wmoUnit:percent",
            },
            textDescription: "Mostly Clear",
            timestamp: "2025-06-03T16:47:00+00:00",
          }),
        },
      ],
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0]).toEqual([
      "https://api.weather.gov/gridpoints/PSR/171,48/stations?limit=1",
      expect.objectContaining({ headers: expect.any(Object) }),
    ]);
    expect(mockFetch.mock.calls[1]).toEqual([
      "https://api.weather.gov/stations/KCHD/observations/latest",
      expect.objectContaining({ headers: expect.any(Object) }),
    ]);
  });

  it("getCurrentWeather throws if first fetch not ok", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(
      tool["getCurrentWeather"](
        "https://api.weather.gov/gridpoints/PSR/171,48",
      ),
    ).rejects.toThrow("Error fetching stations: 500");
  });

  it("getCurrentWeather throws if first fetch returns undefined features", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    await expect(
      tool["getCurrentWeather"](
        "https://api.weather.gov/gridpoints/PSR/171,48",
      ),
    ).rejects.toThrow();
  });

  it("getCurrentWeather throws if first fetch returns empty features", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });
    await expect(
      tool["getCurrentWeather"](
        "https://api.weather.gov/gridpoints/PSR/171,48",
      ),
    ).rejects.toThrow();
  });

  it("getCurrentWeather throws if first fetch returns undefined properties", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{}] }),
    });
    await expect(
      tool["getCurrentWeather"](
        "https://api.weather.gov/gridpoints/PSR/171,48",
      ),
    ).rejects.toThrow();
  });

  it("getCurrentWeather throws if first fetch returns undefined stationIdentifier", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [{ properties: {} }] }),
    });
    await expect(
      tool["getCurrentWeather"](
        "https://api.weather.gov/gridpoints/PSR/171,48",
      ),
    ).rejects.toThrow("No valid stationIdentifier found in the response");
  });

  it("getCurrentWeather throws if first fetch returns empty stationIdentifier", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ properties: { stationIdentifier: "" } }],
      }),
    });
    await expect(
      tool["getCurrentWeather"](
        "https://api.weather.gov/gridpoints/PSR/171,48",
      ),
    ).rejects.toThrow("No valid stationIdentifier found in the response");
  });

  it("getCurrentWeather throws if second fetch not ok", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              stationIdentifier: "KCHD",
            },
          },
        ],
      }),
    });
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(
      tool["getCurrentWeather"](
        "https://api.weather.gov/gridpoints/PSR/171,48",
      ),
    ).rejects.toThrow("Error fetching observations: 500");
  });

  it("getCurrentWeather throws if second fetch returns undefined properties", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              stationIdentifier: "KCHD",
            },
          },
        ],
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    await expect(
      tool["getCurrentWeather"](
        "https://api.weather.gov/gridpoints/PSR/171,48",
      ),
    ).rejects.toThrow();
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
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              stationIdentifier: "KCHD",
            },
          },
        ],
      }),
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          temperature: {
            unitCode: "wmoUnit:degC",
            value: 30,
            qualityControl: "V",
          },
          windSpeed: {
            unitCode: "wmoUnit:km_h-1",
            value: 5,
            qualityControl: "V",
          },
          windDirection: {
            unitCode: "wmoUnit:degree_(angle)",
            value: 225,
            qualityControl: "V",
          },
          visibility: {
            unitCode: "wmoUnit:m",
            value: 16090,
            qualityControl: "C",
          },
          precipitationLastHour: {
            unitCode: "wmoUnit:mm",
            value: null,
            qualityControl: "Z",
          },
          relativeHumidity: {
            unitCode: "wmoUnit:percent",
            value: 40.172842074825,
            qualityControl: "V",
          },
          textDescription: "Mostly Clear",
          timestamp: "2025-06-03T16:47:00+00:00",
        },
      }),
    });
    const result = await tool.handleRequest({
      params: { gridPointUrl: "https://api.weather.gov/gridpoints/PSR/171,48" },
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            temperature: {
              value: 30,
              unit: "wmoUnit:degC",
            },
            windSpeed: {
              value: 5,
              unit: "wmoUnit:km_h-1",
            },
            windDirection: {
              value: 225,
              unit: "wmoUnit:degree_(angle)",
            },
            visibility: {
              value: 16090,
              unit: "wmoUnit:m",
            },
            precipitationLastHour: {
              value: 0,
              unit: "wmoUnit:mm",
            },
            relativeHumidity: {
              value: 40.172842074825,
              unit: "wmoUnit:percent",
            },
            textDescription: "Mostly Clear",
            timestamp: "2025-06-03T16:47:00+00:00",
          }),
        },
      ],
    });
  });

  it("handleRequest returns ToolValidationError message if thrown", async () => {
    const tool = new CurrentWeather();
    const result = await tool.handleRequest({
      params: { gridPointUrl: "https://api.summer.gov/gridpoints/PSR/171,48" },
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: 'Invalid grid point URL "https://api.summer.gov/gridpoints/PSR/171,48". Ask user for a valid grid point URL.',
        },
      ],
    });
  });

  it("handleRequest re-throws error other than ToolValidationError", async () => {
    class DummyError extends Error {}
    class ErrorTool extends CurrentWeather {
      validateWithDefaults(): Record<string, any> {
        throw new DummyError("validation failed");
      }
    }
    const tool = new ErrorTool(mockFetch as unknown as typeof globalThis.fetch);
    try {
      await tool.handleRequest({
        params: {
          gridPointUrl: "https://api.weather.gov/gridpoints/PSR/171,48",
        },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DummyError);
      // @ts-ignore
      expect(error.message).toBe("validation failed");
    }
  });
});
