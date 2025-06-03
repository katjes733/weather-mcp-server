import { ToolValidationError } from "~/errors/ToolValidationError";
import { AbstractTool } from "~/types/AbstractTool";
import type { ITool } from "~/types/ITool";
import dedent from "dedent";

export class CurrentWeather extends AbstractTool implements ITool {
  // Explicit constructor definition to ensure test coverage in Bun tracks constructor.
  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    super(fetch);
  }

  getName() {
    return "current-weather";
  }

  getDescription() {
    return dedent`
      Get the current weather for a specific location using a grid point URL.
      System Prompt:
      - Always ask the user for the 'gridPointUrl' parameter if it is not provided. Avoid inferring or making up values.
      - If the parameter is not a valid grid point URL, ask the user to provide a valid grid point URL.
      - Use 'daily-forecast-weather' tool if user wants the weather forecast instead of the current weather.
      - Use 'hourly-forecast-weather' tool if user wants the hourly (explicitly stated) forecast instead of the current weather.
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

    return this.getCurrentWeather(gridPointUrl).then((weather) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(weather),
        },
      ],
    }));
  }

  private async getCurrentWeather(gridPointUrl: string) {
    const headers = {
      "User-Agent": "weather-mcp-server (katjes733@gmx.net)",
    };
    const observationStationsUrl = `${gridPointUrl}/stations?limit=1`;

    const stationsResponse = await this.fetch(observationStationsUrl, {
      headers,
    });

    if (!stationsResponse.ok) {
      throw new Error(`Error fetching stations: ${stationsResponse.status}`);
    }

    const stationsData = (await stationsResponse.json()) as {
      features: { properties: { stationIdentifier: string } }[];
    };
    const stationId = stationsData.features[0].properties.stationIdentifier;
    if (!stationId) {
      throw new Error(
        `No valid stationIdentifier found in the response: ${stationId}`,
      );
    }

    const observationsUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`;
    const observationsResponse = await this.fetch(observationsUrl, {
      headers,
    });

    if (!observationsResponse.ok) {
      throw new Error(
        `Error fetching observations: ${observationsResponse.status}`,
      );
    }

    const observationsData = await observationsResponse.json();
    const weather = (observationsData as { properties: Record<string, any> })
      .properties;

    return {
      temperature: {
        value: weather.temperature.value,
        unit: weather.temperature.unitCode,
      },
      windSpeed: {
        value: weather.windSpeed.value,
        unit: weather.windSpeed.unitCode,
      },
      windDirection: {
        value: weather.windDirection.value,
        unit: weather.windDirection.unitCode,
      },
      visibility: {
        value: weather.visibility.value,
        unit: weather.visibility.unitCode,
      },
      precipitationLastHour: {
        value: weather.precipitationLastHour.value || 0,
        unit: weather.precipitationLastHour.unitCode,
      },
      relativeHumidity: {
        value: weather.relativeHumidity.value,
        unit: weather.relativeHumidity.unitCode,
      },
      textDescription: weather.textDescription,
      timestamp: weather.timestamp,
    };
  }
}
