import pathModule from "path";
import fs from "fs/promises";
import type { ITool } from "./types/ITool";

/* eslint-disable no-unused-vars */
export interface FileSystem {
  readdir: (
    path: string,
    options?: { recursive?: boolean },
  ) => Promise<string[]>;
}
/* eslint-enable no-unused-vars */

const defaultFs: FileSystem = {
  readdir: fs.readdir,
};

export class Helper {
  private fetch: typeof globalThis.fetch;
  private fs: FileSystem;
  private path: typeof pathModule;
  private tools: Map<string, ITool> | undefined = undefined;
  private toolsLoading: Promise<void> | null = null;

  constructor(
    fetchDep: typeof globalThis.fetch = globalThis.fetch,
    fsDep: FileSystem = defaultFs,
    pathDep: typeof pathModule = pathModule,
  ) {
    this.fetch = fetchDep;
    this.fs = fsDep;
    this.path = pathDep;
  }

  private async preloadTools(): Promise<void> {
    if (this.tools) {
      return;
    }

    const toolsDir = this.path.join(__dirname, "tools");
    const files = await this.fs.readdir(toolsDir, { recursive: true });

    this.tools = new Map<string, ITool>();

    for (const file of files) {
      if (file.endsWith(".ts")) {
        const modulePath = this.path.join(toolsDir, file);
        const module = await import(modulePath);

        for (const exportedClass of Object.values(module)) {
          if (typeof exportedClass === "function") {
            const instance = new (exportedClass as new () => ITool)();
            if ("getName" in instance) {
              this.tools.set(instance.getName(), instance);
            }
          }
        }
      }
    }
  }

  public async loadTools(): Promise<void> {
    if (!this.toolsLoading) {
      this.toolsLoading = this.preloadTools();
    }
    await this.toolsLoading;
  }

  public getToolsSync(): Map<string, ITool> {
    if (!this.tools) {
      throw new Error(
        "Tools have not been loaded yet. Call loadTools() first.",
      );
    }
    return this.tools;
  }
}
