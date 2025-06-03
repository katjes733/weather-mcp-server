import { describe, it, expect, beforeEach, jest, afterEach } from "bun:test";
import { DailyForecastWeather } from "../DailyForecastWeather";
import dedent from "dedent";

const mockFetch = jest.fn();

function createInstance() {
  const instance = new DailyForecastWeather(
    mockFetch as unknown as typeof globalThis.fetch,
  );
  return instance;
}

describe("DailyForecastWeather", () => {
  const originalAppName = process.env.APP_NAME;
  const originalAppEmail = process.env.APP_EMAIL;

  const expectedName = "daily-forecast-weather";
  const expectedDescription = dedent`
      Get the daily weather forecast (including break down for day and night) for a specific grid point using a grid point URL.
      The weather forecast data can be used to provide detailed weather information for the next seven days.
      System Prompt:
      - Always ask the user for the 'gridPointUrl' parameter if it is not provided. Avoid inferring or making up values.
      - If the parameter is not a valid grid point URL, ask the user to provide a valid grid point URL.
      - Use 'current-weather' tool if user wants the current weather instead of the forecast.
      - This tool provides a daily forecast, which includes both day and night weather conditions.
      - This tool is specifically designed to provide a daily forecast, not an hourly forecast.
      - This tool is the default forecast tool unless the user specifies explicitly they want an hourly forecast.
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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          periods: [
            {
              name: "Today",
              startTime: "2025-06-03T08:00:00-07:00",
              endTime: "2025-06-03T18:00:00-07:00",
              isDaytime: true,
              shortForecast: "Sunny",
              temperature: 96,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                unitCode: "wmoUnit:percent",
                value: 3,
              },
              windSpeed: "0 to 5 mph",
              windDirection: "SW",
            },
            {
              name: "Tonight",
              startTime: "2025-06-03T18:00:00-07:00",
              endTime: "2025-06-04T06:00:00-07:00",
              isDaytime: false,
              shortForecast: "Cloudy",
              temperature: 70,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                unitCode: "",
              },
              windSpeed: "5 to 10 mph",
              windDirection: "SSW",
            },
            {
              name: "Wednesday",
              startTime: "2025-06-04T06:00:00-07:00",
              endTime: "2025-06-04T18:00:00-07:00",
              isDaytime: true,
              shortForecast: "Mostly sunny",
              temperature: 97,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                value: 4,
              },
              windSpeed: "10 to 15 mph",
              windDirection: "S",
            },
            {
              name: "Wednesday Night",
              startTime: "2025-06-04T18:00:00-07:00",
              endTime: "2025-06-05T06:00:00-07:00",
              isDaytime: false,
              shortForecast: "Mostly Clear",
              temperature: 71,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                unitCode: "wmoUnit:other",
                value: 2,
              },
              windSpeed: "0 to 5 mph",
              windDirection: "SSW",
            },
          ],
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
          text: JSON.stringify([
            {
              name: "Today",
              valid: {
                startTime: "2025-06-03T08:00:00-07:00",
                endTime: "2025-06-03T18:00:00-07:00",
              },
              isDaytime: true,
              shortForecast: "Sunny",
              temperature: 96,
              temperatureUnit: "F",
              probabilityOfPrecipitation: "3 %",
              windSpeed: "0 to 5 mph",
              windDirection: "SW",
            },
            {
              name: "Tonight",
              valid: {
                startTime: "2025-06-03T18:00:00-07:00",
                endTime: "2025-06-04T06:00:00-07:00",
              },
              isDaytime: false,
              shortForecast: "Cloudy",
              temperature: 70,
              temperatureUnit: "F",
              probabilityOfPrecipitation: "0 %",
              windSpeed: "5 to 10 mph",
              windDirection: "SSW",
            },
            {
              name: "Wednesday",
              valid: {
                startTime: "2025-06-04T06:00:00-07:00",
                endTime: "2025-06-04T18:00:00-07:00",
              },
              isDaytime: true,
              shortForecast: "Mostly sunny",
              temperature: 97,
              temperatureUnit: "F",
              probabilityOfPrecipitation: "4 %",
              windSpeed: "10 to 15 mph",
              windDirection: "S",
            },
            {
              name: "Wednesday Night",
              valid: {
                startTime: "2025-06-04T18:00:00-07:00",
                endTime: "2025-06-05T06:00:00-07:00",
              },
              isDaytime: false,
              shortForecast: "Mostly Clear",
              temperature: 71,
              temperatureUnit: "F",
              probabilityOfPrecipitation: "2",
              windSpeed: "0 to 5 mph",
              windDirection: "SSW",
            },
          ]),
          annotations: {
            includeInContext: false,
          },
        },
      ],
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.weather.gov/gridpoints/PSR/171,48/forecast?units=us",
      expect.objectContaining({
        headers: expect.any(Object),
      }),
    );
  });

  it("getForecastDaily throws if fetch not ok", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(
      tool["getForecastDaily"]("https://api.weather.gov/gridpoints/PSR/171,48"),
    ).rejects.toThrow("Error fetching forecast data: 500");
  });

  it("getForecastDaily returns forecast from URL", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          periods: [
            {
              name: "Today",
              startTime: "2025-06-03T08:00:00-07:00",
              endTime: "2025-06-03T18:00:00-07:00",
              isDaytime: true,
              shortForecast: "Sunny",
              temperature: 96,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                unitCode: "wmoUnit:percent",
                value: 3,
              },
              windSpeed: "0 to 5 mph",
              windDirection: "SW",
            },
          ],
        },
      }),
    });
    const result = await tool["getForecastDaily"](
      "https://api.weather.gov/gridpoints/PSR/171,48",
    );
    expect(result).toEqual([
      {
        name: "Today",
        valid: {
          startTime: "2025-06-03T08:00:00-07:00",
          endTime: "2025-06-03T18:00:00-07:00",
        },
        isDaytime: true,
        shortForecast: "Sunny",
        temperature: 96,
        temperatureUnit: "F",
        probabilityOfPrecipitation: "3 %",
        windSpeed: "0 to 5 mph",
        windDirection: "SW",
      },
    ]);
  });

  it("getForecastDaily throws if API returns no properties property", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    await expect(
      tool["getForecastDaily"]("https://api.weather.gov/gridpoints/PSR/171,48"),
    ).rejects.toThrow();
  });

  it("getForecastDaily returns empty array if API returns undefined periods", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ properties: {} }),
    });
    const result = await tool["getForecastDaily"](
      "https://api.weather.gov/gridpoints/PSR/171,48",
    );
    expect(result).toEqual([]);
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
          periods: [
            {
              name: "Today",
              startTime: "2025-06-03T08:00:00-07:00",
              endTime: "2025-06-03T18:00:00-07:00",
              isDaytime: true,
              shortForecast: "Sunny",
              temperature: 96,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                unitCode: "wmoUnit:percent",
                value: 3,
              },
              windSpeed: "0 to 5 mph",
              windDirection: "SW",
            },
          ],
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
          text: JSON.stringify([
            {
              name: "Today",
              valid: {
                startTime: "2025-06-03T08:00:00-07:00",
                endTime: "2025-06-03T18:00:00-07:00",
              },
              isDaytime: true,
              shortForecast: "Sunny",
              temperature: 96,
              temperatureUnit: "F",
              probabilityOfPrecipitation: "3 %",
              windSpeed: "0 to 5 mph",
              windDirection: "SW",
            },
          ]),
          annotations: {
            includeInContext: false,
          },
        },
      ],
    });
  });

  it("handleRequest returns ToolValidationError message if thrown", async () => {
    const tool = new DailyForecastWeather();
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
    class ErrorTool extends DailyForecastWeather {
      validateWithDefaults(params: Record<string, any>): Record<string, any> {
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
