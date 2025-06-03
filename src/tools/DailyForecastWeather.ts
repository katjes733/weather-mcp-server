import { ToolValidationError } from "~/errors/ToolValidationError";
import { AbstractTool } from "~/types/AbstractTool";
import type { ITool } from "~/types/ITool";
import dedent from "dedent";

export class DailyForecastWeather extends AbstractTool implements ITool {
  // Explicit constructor definition to ensure test coverage in Bun tracks constructor.
  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    super(fetch);
  }

  getName() {
    return "daily-forecast-weather";
  }

  getDescription() {
    return dedent`
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
  }

  getInputSchema(): {
    type: string;
    properties: Record<string, any>;
    required: string[];
  } {
    return {
      type: "object",
      properties: {
        gridPointUrl: { type: "string" },
      },
      required: ["gridPointUrl"],
    };
  }

  validateWithDefaults(params: Record<string, any>): Record<string, any> {
    const { gridPointUrl } = params;

    if (
      typeof gridPointUrl !== "string" ||
      !/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3}\/\d+,\d+$/.test(
        gridPointUrl,
      )
    ) {
      throw new ToolValidationError(
        `Invalid grid point URL "${gridPointUrl}". Ask user for a valid grid point URL.`,
      );
    }

    return { gridPointUrl };
  }

  async processToolWorkflow(params: Record<string, any>): Promise<{
    content: {
      type: string;
      text: string;
      annotations?: Record<string, any>;
    }[];
  }> {
    const { gridPointUrl } = this.validateWithDefaults(params);

    return this.getForecastDaily(gridPointUrl).then((weather) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(weather),
          annotations: {
            includeInContext: false,
          },
        },
      ],
    }));
  }

  private async getForecastDaily(gridPointUrl: string) {
    const headers = {
      "User-Agent": "weather-mcp-server (katjes733@gmx.net)",
    };

    const forecastUrl = `${gridPointUrl}/forecast?units=us`;
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
    const forecastPeriods = forecastDataTyped.properties.periods || [];

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
        probabilityOfPrecipitation:
          `${halfDay.probabilityOfPrecipitation?.value || 0} ${(halfDay.probabilityOfPrecipitation?.unitCode || "percent").includes("percent") ? "%" : ""}`.trim(),
        windSpeed: halfDay.windSpeed,
        windDirection: halfDay.windDirection,
      })),
    );
  }
}
