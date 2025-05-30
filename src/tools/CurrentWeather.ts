import dedent from "dedent";
import type { ITool } from "~/types/ITool";

export class CurrentWeather implements ITool {
  private fetch: typeof globalThis.fetch;

  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetch;
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
      - Use 'forecast-weather' tool if user wants the weather forecast instead of the current weather.
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

    const currentWeather = await this.getCurrentWeather(gridPointUrl);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(currentWeather),
        },
      ],
    };
  };

  private async getCurrentWeather(gridPointUrl: string) {
    const headers = {
      "User-Agent": "weather-mcp-server (katjes733@gmx.net)",
    };
    const observationStationsUrl = `${gridPointUrl}/stations`;

    const stationsResponse = await fetch(observationStationsUrl, {
      headers,
    });

    if (!stationsResponse.ok) {
      throw new Error(`Error fetching stations: ${stationsResponse.status}`);
    }

    const stationsData = (await stationsResponse.json()) as {
      features: { properties: { stationIdentifier: string } }[];
    };
    const stationId = stationsData.features[0].properties.stationIdentifier;

    const observationsUrl = `https://api.weather.gov/stations/${stationId}/observations/latest`;
    const observationsResponse = await fetch(observationsUrl, {
      headers,
    });

    if (!observationsResponse.ok) {
      throw new Error(
        `Error fetching observations: ${observationsResponse.status}`,
      );
    }

    const observationsData = await observationsResponse.json();
    const weather = (observationsData as { properties: any }).properties;

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
        value: weather.precipitationLastHour.value,
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
