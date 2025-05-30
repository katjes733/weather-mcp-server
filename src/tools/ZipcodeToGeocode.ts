import dedent from "dedent";
import type { ITool } from "~/types/ITool";

export class ZipcodeToGeocode implements ITool {
  private fetch: typeof globalThis.fetch;

  constructor(fetch: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetch;
  }

  getName() {
    return "zipcode-to-geocode";
  }

  getDescription() {
    return dedent`
      Convert a US ZIP code to geographic coordinates (latitude and longitude).
      System Prompt:
      - Always ask the user for the 'zipcode' parameter if it is not provided. Avoid inferring or making up values.
      - If the parameter is not a valid ZIP code, ask the user to provide a valid ZIP code.
      Parameters:
      - 'zipcode': a valid US ZIP code. If not provided, it will be requested from the user.
    `;
  }

  getToolConfig() {
    return {
      name: this.getName(),
      description: this.getDescription(),
      inputSchema: {
        type: "object",
        properties: {
          zipcode: { type: "string" },
        },
        required: ["zipcode"],
      },
    };
  }

  handleRequest = async (request: {
    params: {
      zipcode: string;
    };
  }) => {
    const { zipcode } = request.params as {
      zipcode: string;
    };

    if (typeof zipcode !== "string" || !/^\d{5}(-\d{4})?$/.test(zipcode)) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid US Zip code "${zipcode}". Ask user for a valid US Zip code.`,
          },
        ],
      };
    }

    const { latitude, longitude } = await this.zipcodeToGeocode(zipcode);

    return {
      content: [
        {
          type: "text",
          text: `Coordinates for ZIP code ${zipcode}: Latitude ${latitude}, Longitude ${longitude}.`,
        },
      ],
    };
  };

  private async zipcodeToGeocode(
    zipcode: string,
  ): Promise<{ latitude: string; longitude: string }> {
    const response = await this.fetch(
      `https://api.zippopotam.us/us/${zipcode}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch data for zipcode ${zipcode}`);
    }

    const data = (await response.json()) as {
      places: { latitude: string; longitude: string }[];
    };
    return {
      latitude: data.places[0].latitude,
      longitude: data.places[0].longitude,
    };
  }
}
