import dedent from "dedent";
import type { ITool } from "~/types/ITool";

export class GridPointUrl implements ITool {
  private fetch: typeof globalThis.fetch;

  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetch;
  }

  getName() {
    return "get-grid-point-url";
  }

  getDescription() {
    return dedent`
      Generate a URL for a specific grid point using latitude and longitude. This URL can be used to access weather data for that grid point.
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

    const { gridPointUrl } = await this.getGridPointUrl(latitude, longitude);

    return {
      content: [
        {
          type: "text",
          text: `URL to access weather data for grid point at Latitude ${latitude}, Longitude ${longitude}: ${gridPointUrl}`,
        },
      ],
    };
  };

  private async getGridPointUrl(
    latitude: number,
    longitude: number,
  ): Promise<{ gridPointUrl: string }> {
    const headers = {
      "User-Agent": "weather-mcp-server (katjes733@gmx.net)",
    };
    const pointUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
    const pointResponse = await fetch(pointUrl, {
      headers,
    });

    if (!pointResponse.ok) {
      throw new Error(`Error fetching point data: ${pointResponse.status}`);
    }

    const pointData = (await pointResponse.json()) as {
      properties: {
        forecastGridData: string;
      };
    };

    return {
      gridPointUrl: pointData.properties.forecastGridData,
    };
  }
}
