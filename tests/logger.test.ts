import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger, LogLevel } from "../src/logger/Logger";

describe("Logger", () => {
  const originalConsole = { ...console };

  beforeEach(() => {
    console.log = vi.fn();
    console.debug = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.debug = originalConsole.debug;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  it("logs info by default", () => {
    const logger = new Logger();
    logger.info("test message");
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it("suppresses debug when level is INFO", () => {
    const logger = new Logger({ level: LogLevel.INFO });
    logger.debug("hidden");
    expect(console.debug).not.toHaveBeenCalled();
  });

  it("logs debug when level is DEBUG", () => {
    const logger = new Logger({ level: LogLevel.DEBUG });
    logger.debug("visible");
    expect(console.debug).toHaveBeenCalledTimes(1);
  });

  it("logs nothing when disabled", () => {
    const logger = new Logger({ enabled: false });
    logger.info("nope");
    logger.error("nope");
    expect(console.log).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("uses console.error for ERROR level", () => {
    const logger = new Logger({ level: LogLevel.DEBUG });
    logger.error("fail");
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("uses console.warn for WARN level", () => {
    const logger = new Logger({ level: LogLevel.DEBUG });
    logger.warn("warning");
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("delegates to custom logger when provided", () => {
    const custom = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const logger = new Logger({ custom });
    logger.info("test", { key: "value" });
    expect(custom.info).toHaveBeenCalledWith("test", { key: "value" });
    expect(console.log).not.toHaveBeenCalled();
  });

  it("includes context when provided", () => {
    const logger = new Logger({ level: LogLevel.DEBUG });
    logger.debug("msg", { foo: 1 });
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining("[WAH DEBUG]"),
      "msg",
      { foo: 1 }
    );
  });
});
