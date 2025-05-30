import dedent from "dedent";
import type { ITool } from "~/types/ITool";

export class ForecastWeather implements ITool {
  private fetch: typeof globalThis.fetch;

  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetch;
  }

  getName() {
    return "forecast-weather";
  }

  getDescription() {
    return dedent`
      Get the weather forecast for a specific grid point using a grid point URL. The weather forecast data can be used to provide detailed weather information for the next seven days.
      System Prompt:
      - Always ask the user for the 'gridPointUrl' parameter if it is not provided. Avoid inferring or making up values.
      - If the parameter is not a valid grid point URL, ask the user to provide a valid grid point URL.
      - Use 'current-weather' tool if user wants the current weather instead of the forecast.
      Parameters:
      - 'gridPointUrl': a valid grid point URL from the National Weather Service API. If not provided, it will be requested from the user.
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
        },
        required: ["gridPointUrl"],
      },
    };
  }

  handleRequest = async (request: {
    params: {
      gridPointUrl: string;
    };
  }) => {
    const { gridPointUrl } = request.params as {
      gridPointUrl: string;
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

    const weather = await this.getForecast(gridPointUrl);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(weather),
        },
      ],
    };
  };

  private async getForecast(gridPointUrl: string) {
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
    const forecastPeriods = forecastDataTyped.properties.periods;

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
