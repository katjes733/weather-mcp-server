import { ToolValidationError } from "~/errors/ToolValidationError";
import { AbstractTool } from "~/types/AbstractTool";
import type { ITool } from "~/types/ITool";
import dedent from "dedent";

export class GridPointUrl extends AbstractTool implements ITool {
  // Explicit constructor definition to ensure test coverage in Bun tracks constructor.
  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    super(fetch);
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

  getInputSchema(): {
    type: string;
    properties: Record<string, any>;
    required: string[];
  } {
    return {
      type: "object",
      properties: {
        latitude: { type: "number" },
        longitude: { type: "number" },
      },
      required: ["latitude", "longitude"],
    };
  }

  validateWithDefaults(params: Record<string, any>): Record<string, any> {
    const { latitude, longitude } = params;

    if (
      typeof latitude !== "number" ||
      latitude < -90 ||
      latitude > 90 ||
      typeof longitude !== "number" ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new ToolValidationError(
        `Invalid coordinates: Latitude ${latitude}, Longitude ${longitude}. Ask user for valid coordinates.`,
      );
    }

    return { latitude, longitude };
  }

  async processToolWorkflow(
    params: Record<string, any>,
  ): Promise<{ content: { type: string; text: string }[] }> {
    const { latitude, longitude } = this.validateWithDefaults(params);

    const { gridPointUrl } = await this.getGridPointUrl(latitude, longitude);

    return {
      content: [
        {
          type: "text",
          text: `URL to access weather data for grid point at Latitude ${latitude}, Longitude ${longitude}: ${gridPointUrl}`,
        },
      ],
    };
  }

  private async getGridPointUrl(
    latitude: number,
    longitude: number,
  ): Promise<{ gridPointUrl: string }> {
    const headers = {
      "User-Agent": this.getUserAgentHeaderText(),
    };
    const pointUrl = `https://api.weather.gov/points/${latitude},${longitude}`;
    const pointResponse = await this.fetch(pointUrl, {
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
