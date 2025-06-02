import { test as it, expect } from "bun:test";
import { Helper } from "../helper";
import path from "path";
import fs from "fs/promises";

it("getToolsSync throws error if tools are not loaded", () => {
  const helper = new Helper();
  expect(() => helper.getToolsSync()).toThrow(
    "Tools have not been loaded yet. Call loadTools() first.",
  );
});

it("loadTools with empty file list returns an empty Map", async () => {
  const mockedFs = {
    readdir: async (_dir: string, _options?: { recursive?: boolean }) => {
      return [];
    },
  };

  const helper = new Helper(globalThis.fetch, mockedFs, path);
  await helper.loadTools();
  expect(helper.getToolsSync().size).toBe(0);
});

it("loadTools ignores non-.ts files", async () => {
  const mockedFs = {
    readdir: async (_dir: string, _options?: { recursive?: boolean }) => {
      return ["not_a_tool.txt", "another.doc"];
    },
  };

  const helper = new Helper(globalThis.fetch, mockedFs, path);
  await helper.loadTools();
  expect(helper.getToolsSync().size).toBe(0);
});

it("loadTools loads tools from .ts files using a real file", async () => {
  const helper = new Helper();

  await helper.loadTools();
  const tools = helper.getToolsSync();

  expect(tools.size).toBeGreaterThan(0);
  expect(tools.values().next().value?.getName()).not.toBeNull();
});

it("loadTools executes preloadTools only once", async () => {
  let callCount = 0;
  const mockedFs = {
    readdir: async (_dir: string, _options?: { recursive?: boolean }) => {
      callCount++;
      return [];
    },
  };

  const helper = new Helper(globalThis.fetch, mockedFs, path);
  await helper.loadTools();
  await helper.loadTools();
  expect(callCount).toBe(1);
});
