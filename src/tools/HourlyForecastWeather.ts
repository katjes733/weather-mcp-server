import { AbstractTool } from "~/types/AbstractTool";
import type { ITool } from "~/types/ITool";
import { ToolValidationError } from "~/errors/ToolValidationError";
import dedent from "dedent";

export class HourlyForecastWeather extends AbstractTool implements ITool {
  // Explicit constructor definition to ensure test coverage in Bun tracks constructor.
  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    super(fetch);
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

  getInputSchema(): {
    type: string;
    properties: Record<string, any>;
    required: string[];
  } {
    return {
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
  }

  validateWithDefaults(params: Record<string, any>): Record<string, any> {
    const { gridPointUrl, forecastHours } = params;

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
    if (!forecastHours) {
      return { gridPointUrl, forecastHours: 24 }; // Default to 24 hours if not provided
    }
    if (
      typeof forecastHours !== "number" ||
      forecastHours < 1 ||
      forecastHours > 156
    ) {
      throw new ToolValidationError(
        `Invalid forecast hours value "${forecastHours}". Valid range is from 1 to 156 hours. Ask user for a valid forecast hours value.`,
      );
    }

    return { gridPointUrl, forecastHours };
  }

  async processToolWorkflow(params: Record<string, any>): Promise<{
    content: {
      type: string;
      text: string;
      annotations?: Record<string, any>;
    }[];
  }> {
    const { gridPointUrl, forecastHours } = params;

    return this.getForecastHourly(gridPointUrl, forecastHours).then(
      (weather) => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(weather),
            annotations: {
              includeInContext: false,
            },
          },
        ],
      }),
    );
  }

  private async getForecastHourly(gridPointUrl: string, forecastHours: number) {
    const headers = {
      "User-Agent": this.getUserAgentHeaderText(),
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
    const forecastPeriods = (forecastDataTyped.properties.periods || []).slice(
      0,
      forecastHours,
    );

    return Array.from(
      forecastPeriods.map((hourData) => ({
        valid: {
          startTime: hourData.startTime,
          endTime: hourData.endTime,
        },
        isDaytime: hourData.isDaytime,
        shortForecast: hourData.shortForecast,
        temperature: hourData.temperature,
        temperatureUnit: hourData.temperatureUnit,
        probabilityOfPrecipitation:
          `${hourData.probabilityOfPrecipitation?.value || 0} ${(hourData.probabilityOfPrecipitation?.unitCode || "percent").includes("percent") ? "%" : ""}`.trim(),
        windSpeed: hourData.windSpeed,
        windDirection: hourData.windDirection,
      })),
    );
  }
}
