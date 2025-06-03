import { describe, it, expect, beforeEach, jest, afterEach } from "bun:test";
import { HourlyForecastWeather } from "../HourlyForecastWeather";
import dedent from "dedent";

const mockFetch = jest.fn();

function createInstance() {
  const instance = new HourlyForecastWeather(
    mockFetch as unknown as typeof globalThis.fetch,
  );
  return instance;
}

describe("DailyForecastWeather", () => {
  const originalAppName = process.env.APP_NAME;
  const originalAppEmail = process.env.APP_EMAIL;

  const expectedName = "hourly-forecast-weather";
  const expectedDescription = dedent`
      Get the hourly weather forecast for a specific grid point using a grid point URL.
      The weather forecast data can be used to provide detailed weather information for up to the next 6.5 days, but is limited by default to the next 24 hours
      System Prompt:
      - Always ask the user for the 'gridPointUrl' parameter if it is not provided. Avoid inferring or making up values.
      - If the parameter is not a valid grid point URL, ask the user to provide a valid grid point URL.
      - Use 'current-weather' tool if user wants the current weather instead of the forecast.
      - This tool provides an hourly forecast, which includes detailed weather conditions for each hour.
      - This tool is specifically designed to provide an hourly forecast, not a daily forecast.
      - Avoid using this tool for daily forecasts, as it is intended for hourly weather data.
      - Avoid using this tool unless the user explicitly requests an hourly forecast. For unspecified forecasts, use the 'daily-forecast-weather' tool instead.
      Parameters:
      - 'gridPointUrl': a valid grid point URL from the National Weather Service API. If not provided, it will be requested from the user.
      - 'forecastHours': the number of hours to forecast, default is 24 hours. Valid range is from 1 to 156 hours.
    `;
  const expectedInputSchema = {
    type: "object",
    properties: {
      gridPointUrl: { type: "string" },
      forecastHours: {
        type: "number",
        default: 24,
        minimum: 1,
        maximum: 156,
      },
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
      forecastHours: 24,
    });
    expect(
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/KEY/14,23",
        forecastHours: 48,
      }),
    ).toEqual({
      gridPointUrl: "https://api.weather.gov/gridpoints/KEY/14,23",
      forecastHours: 48,
    });
    expect(
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/KEY/14,23",
        forecastHours: "",
      }),
    ).toEqual({
      gridPointUrl: "https://api.weather.gov/gridpoints/KEY/14,23",
      forecastHours: 24,
    });
    expect(
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/KEY/14,23",
        forecastHours: 0,
      }),
    ).toEqual({
      gridPointUrl: "https://api.weather.gov/gridpoints/KEY/14,23",
      forecastHours: 24,
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

    expect(() =>
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/PSR/171,48",
        forecastHours: "48",
      }),
    ).toThrow("Invalid forecast hours value");
    expect(() =>
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/PSR/171,48",
        forecastHours: -1,
      }),
    ).toThrow("Invalid forecast hours value");
    expect(() =>
      tool.validateWithDefaults({
        gridPointUrl: "https://api.weather.gov/gridpoints/PSR/171,48",
        forecastHours: 157,
      }),
    ).toThrow("Invalid forecast hours value");
  });

  it("processToolWorkflow returns correct content for valid gridPointUrl and forecastHours", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          periods: [
            {
              startTime: "2025-06-03T10:00:00-07:00",
              endTime: "2025-06-03T11:00:00-07:00",
              isDaytime: true,
              shortForecast: "Sunny",
              temperature: 86,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                unitCode: "wmoUnit:percent",
                value: 3,
              },
              windSpeed: "0 mph",
              windDirection: "",
            },
            {
              startTime: "2025-06-03T11:00:00-07:00",
              endTime: "2025-06-03T12:00:00-07:00",
              isDaytime: true,
              shortForecast: "Mostly sunny",
              temperature: 88,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                unitCode: "",
              },
              windSpeed: "5 mph",
              windDirection: "SSW",
            },
            {
              startTime: "2025-06-03T12:00:00-07:00",
              endTime: "2025-06-03T13:00:00-07:00",
              isDaytime: true,
              shortForecast: "Sunny",
              temperature: 90,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                value: 4,
              },
              windSpeed: "10 mph",
              windDirection: "SW",
            },
            {
              startTime: "2025-06-03T13:00:00-07:00",
              endTime: "2025-06-03T14:00:00-07:00",
              isDaytime: true,
              shortForecast: "Mostly sunny",
              temperature: 92,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                unitCode: "wmoUnit:other",
                value: 2,
              },
              windSpeed: "0 to 5 mph",
              windDirection: "SSW",
            },
            {
              startTime: "2025-06-03T14:00:00-07:00",
              endTime: "2025-06-03T15:00:00-07:00",
              isDaytime: true,
              shortForecast: "Sunny",
              temperature: 94,
              temperatureUnit: "F",
              probabilityOfPrecipitation: {
                unitCode: "wmoUnit:percent",
                value: 0,
              },
              windSpeed: "0 to 5 mph",
              windDirection: "S",
            },
          ],
        },
      }),
    });
    const result = await tool.processToolWorkflow({
      gridPointUrl: "https://api.weather.gov/gridpoints/PSR/171,48",
      forecastHours: 4,
    });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify([
            {
              valid: {
                startTime: "2025-06-03T10:00:00-07:00",
                endTime: "2025-06-03T11:00:00-07:00",
              },
              isDaytime: true,
              shortForecast: "Sunny",
              temperature: 86,
              temperatureUnit: "F",
              probabilityOfPrecipitation: "3 %",
              windSpeed: "0 mph",
              windDirection: "",
            },
            {
              valid: {
                startTime: "2025-06-03T11:00:00-07:00",
                endTime: "2025-06-03T12:00:00-07:00",
              },
              isDaytime: true,
              shortForecast: "Mostly sunny",
              temperature: 88,
              temperatureUnit: "F",
              probabilityOfPrecipitation: "0 %",
              windSpeed: "5 mph",
              windDirection: "SSW",
            },
            {
              valid: {
                startTime: "2025-06-03T12:00:00-07:00",
                endTime: "2025-06-03T13:00:00-07:00",
              },
              isDaytime: true,
              shortForecast: "Sunny",
              temperature: 90,
              temperatureUnit: "F",
              probabilityOfPrecipitation: "4 %",
              windSpeed: "10 mph",
              windDirection: "SW",
            },
            {
              valid: {
                startTime: "2025-06-03T13:00:00-07:00",
                endTime: "2025-06-03T14:00:00-07:00",
              },
              isDaytime: true,
              shortForecast: "Mostly sunny",
              temperature: 92,
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
      "https://api.weather.gov/gridpoints/PSR/171,48/forecast/hourly?units=us",
      expect.objectContaining({
        headers: expect.any(Object),
      }),
    );
  });

  it("getForecastHourly throws if fetch not ok", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(
      tool["getForecastHourly"](
        "https://api.weather.gov/gridpoints/PSR/171,48",
        4,
      ),
    ).rejects.toThrow("Error fetching forecast data: 500");
  });

  it("getForecastHourly returns forecast from URL", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        properties: {
          periods: [
            {
              startTime: "2025-06-03T11:00:00-07:00",
              endTime: "2025-06-03T12:00:00-07:00",
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
    const result = await tool["getForecastHourly"](
      "https://api.weather.gov/gridpoints/PSR/171,48",
      1,
    );
    expect(result).toEqual([
      {
        valid: {
          startTime: "2025-06-03T11:00:00-07:00",
          endTime: "2025-06-03T12:00:00-07:00",
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

  it("getForecastHourly throws if API returns no properties property", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    await expect(
      tool["getForecastHourly"](
        "https://api.weather.gov/gridpoints/PSR/171,48",
        4,
      ),
    ).rejects.toThrow();
  });

  it("getForecastHourly return empty array if API returns undefined periods", async () => {
    const tool = createInstance();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ properties: {} }),
    });
    const result = await tool["getForecastHourly"](
      "https://api.weather.gov/gridpoints/PSR/171,48",
      4,
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
              startTime: "2025-06-03T10:00:00-07:00",
              endTime: "2025-06-03T11:00:00-07:00",
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
              valid: {
                startTime: "2025-06-03T10:00:00-07:00",
                endTime: "2025-06-03T11:00:00-07:00",
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
    const tool = new HourlyForecastWeather();
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
    class ErrorTool extends HourlyForecastWeather {
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
