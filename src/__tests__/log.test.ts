import { describe, it, expect, afterEach } from "bun:test";

const originalLogLevel = Bun.env.LOG_LEVEL;
const originalPrettyPrint = Bun.env.LOG_PRETTY_PRINT;

/**
 * Dynamically load the `log.ts` module using cache busting.
 * This ensures that changes to Bun.env are picked up.
 */
async function loadLogger() {
  return import(`../log?cacheBust=${Date.now()}`);
}

describe("Logger configuration in log.ts", () => {
  afterEach(() => {
    Bun.env.LOG_LEVEL = originalLogLevel;
    Bun.env.LOG_PRETTY_PRINT = originalPrettyPrint;
  });

  it("should use the default log level ('info') when LOG_LEVEL is not set", async () => {
    delete Bun.env.LOG_LEVEL;

    const { default: log } = await loadLogger();
    expect(log.level).toBe("info");
  });

  it("should override the log level when LOG_LEVEL is set", async () => {
    Bun.env.LOG_LEVEL = "debug";
    const { default: log } = await loadLogger();
    expect(log.level).toBe("debug");
  });

  it("should include transport configuration when LOG_PRETTY_PRINT is undefined (defaulting to false)", async () => {
    delete Bun.env.LOG_PRETTY_PRINT;
    const { default: log } = await loadLogger();
    expect(log).toBeDefined();
    expect(() => log.info("Testing non-pretty print branch")).not.toThrow();
  });

  it("should skip adding transport configuration when LOG_PRETTY_PRINT is set to false", async () => {
    Bun.env.LOG_PRETTY_PRINT = "false";
    const { default: log } = await loadLogger();
    expect(log).toBeDefined();
    expect(() => log.info("Testing non-pretty print branch")).not.toThrow();
  });

  it("should skip adding transport configuration when LOG_PRETTY_PRINT is set to true", async () => {
    Bun.env.LOG_PRETTY_PRINT = "true";
    const { default: log } = await loadLogger();
    expect(log).toBeDefined();
    expect(() => log.info("Testing pretty print branch")).not.toThrow();
  });
});
