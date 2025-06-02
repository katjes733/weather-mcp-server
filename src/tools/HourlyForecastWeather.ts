import dedent from "dedent";
import type { ITool } from "~/types/ITool";

export class ForecastWeather implements ITool {
  private fetch: typeof globalThis.fetch;

  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetch;
  }

  getName() {
    return "hourly-forecast-weather";
  }

  getDescription() {
    return dedent`
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
  }

  getToolConfig() {
    return {
      name: this.getName(),
      description: this.getDescription(),
      inputSchema: {
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
      },
    };
  }

  handleRequest = async (request: {
    params: {
      gridPointUrl: string;
      forecastHours?: number;
    };
  }) => {
    let { gridPointUrl, forecastHours } = request.params as {
      gridPointUrl: string;
      forecastHours?: number;
    };

    if (
      typeof gridPointUrl !== "string" ||
      !/^https:\/\/api\.weather\.gov\/gridpoints\/\w+\/\d+,\d+$/.test(
        gridPointUrl,
      )
    ) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid grid point URL "${gridPointUrl}". Ask user for a valid grid point URL.`,
          },
        ],
      };
    }
    if (!forecastHours) {
      forecastHours = 24; // Default to 24 hours if not provided
    }
    if (
      typeof forecastHours !== "number" ||
      forecastHours < 1 ||
      forecastHours > 156
    ) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid forecast hours value "${forecastHours}". Ask user for a valid forecast hours value.`,
          },
        ],
      };
    }

    const weather = await this.getForecastHourly(gridPointUrl, forecastHours);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(weather),
        },
      ],
    };
  };

  private async getForecastHourly(gridPointUrl: string, forecastHours: number) {
    const headers = {
      "User-Agent": "weather-mcp-server (katjes733@gmx.net)",
    };

    const forecastUrl = `${gridPointUrl}/forecast/hourly?units=us`;
    const forecastResponse = await this.fetch(forecastUrl, {
      headers,
    });

    if (!forecastResponse.ok) {
      throw new Error(
        `Error fetching forecast data: ${forecastResponse.status}`,
      );
    }

    const forecastData = await forecastResponse.json();
    const forecastDataTyped = forecastData as {
      properties: {
        periods: Array<{
          name: string;
          startTime: string;
          endTime: string;
          isDaytime: boolean;
          shortForecast: string;
          temperature: number;
          temperatureUnit: string;
          probabilityOfPrecipitation?: { unitCode: string; value: number };
          windSpeed?: string;
          windDirection?: string;
        }>;
      };
    };
    const forecastPeriods = forecastDataTyped.properties.periods.slice(
      0,
      forecastHours,
    );

    return Array.from(
      forecastPeriods.map((halfDay) => ({
        name: halfDay.name,
        valid: {
          startTime: halfDay.startTime,
          endTime: halfDay.endTime,
        },
        isDaytime: halfDay.isDaytime,
        shortForecast: halfDay.shortForecast,
        temperature: halfDay.temperature,
        temperatureUnit: halfDay.temperatureUnit,
        probabilityOfPrecipitation: halfDay.probabilityOfPrecipitation,
        windSpeed: halfDay.windSpeed,
        windDirection: halfDay.windDirection,
      })),
    );
  }
}
