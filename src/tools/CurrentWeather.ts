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
      Get the current weather for a specific location using latitude and longitude.
      System Prompt:
      - Always ask the user for the 'latitude' and 'longitude' parameters if they are not provided. Avoid inferring or making up values.
      - If the parameters are not valid coordinates, ask the user to provide valid latitude and longitude values.
      Parameters:
      - 'latitude': a valid latitude coordinate (between -90 and 90).
      - 'longitude': a valid longitude coordinate (between -180 and 180).
    `;
  }

  getToolConfig() {
    return {
      name: this.getName(),
      description: this.getDescription(),
      inputSchema: {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
        },
        required: ["latitude", "longitude"],
      },
    };
  }

  handleRequest = async (request: {
    params: {
      latitude: number;
      longitude: number;
    };
  }) => {
    const { latitude, longitude } = request.params as {
      latitude: number;
      longitude: number;
    };

    if (
      typeof latitude !== "number" ||
      latitude < -90 ||
      latitude > 90 ||
      typeof longitude !== "number" ||
      longitude < -180 ||
      longitude > 180
    ) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid coordinates: Latitude ${latitude}, Longitude ${longitude}. Ask user for valid coordinates.`,
          },
        ],
      };
    }

    const weather = await this.getCurrentWeather(latitude, longitude);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(weather, null, 2),
        },
      ],
    };
  };

  private async getCurrentWeather(latitude: number, longitude: number) {
    try {
      const headers = {
        "User-Agent": "weather-mcp-server (katjes733@gmx.net)",
      };
      // Step 1: Get the forecast grid point
      const pointUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
      const pointResponse = await fetch(pointUrl, {
        headers,
      });

      if (!pointResponse.ok) {
        throw new Error(`Error fetching point data: ${pointResponse.status}`);
      }

      const pointData = (await pointResponse.json()) as {
        properties: { observationStations: string };
      };
      const observationStationsUrl = pointData.properties.observationStations;

      // Step 2: Get the nearest observation station
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

      // Step 3: Get current weather observations
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
        textDescription: weather.textDescription,
        timestamp: weather.timestamp,
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      } else {
        console.error("Error:", error);
      }
    }
  }
}
