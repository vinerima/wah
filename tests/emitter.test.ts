import { describe, it, expect, vi } from "vitest";
import { Emitter } from "../src/platform/Emitter";

describe("Emitter", () => {
  it("calls listeners when event is emitted", () => {
    const emitter = new Emitter();
    const fn = vi.fn();
    emitter.on("test", fn);
    emitter.emit("test", "a", 2);
    expect(fn).toHaveBeenCalledWith("a", 2);
  });

  it("returns false when no listeners exist", () => {
    const emitter = new Emitter();
    expect(emitter.emit("nope")).toBe(false);
  });

  it("returns true when listeners exist", () => {
    const emitter = new Emitter();
    emitter.on("x", () => {});
    expect(emitter.emit("x")).toBe(true);
  });

  it("supports multiple listeners on the same event", () => {
    const emitter = new Emitter();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on("e", fn1);
    emitter.on("e", fn2);
    emitter.emit("e", "data");
    expect(fn1).toHaveBeenCalledWith("data");
    expect(fn2).toHaveBeenCalledWith("data");
  });

  it("removes a specific listener with off()", () => {
    const emitter = new Emitter();
    const fn = vi.fn();
    emitter.on("e", fn);
    emitter.off("e", fn);
    emitter.emit("e");
    expect(fn).not.toHaveBeenCalled();
  });

  it("removeAllListeners() with event name clears only that event", () => {
    const emitter = new Emitter();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on("a", fn1);
    emitter.on("b", fn2);
    emitter.removeAllListeners("a");
    emitter.emit("a");
    emitter.emit("b");
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalled();
  });

  it("removeAllListeners() without args clears all events", () => {
    const emitter = new Emitter();
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    emitter.on("a", fn1);
    emitter.on("b", fn2);
    emitter.removeAllListeners();
    emitter.emit("a");
    emitter.emit("b");
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });

  it("on() returns this for chaining", () => {
    const emitter = new Emitter();
    const result = emitter.on("e", () => {});
    expect(result).toBe(emitter);
  });

  it("does not add duplicate references of the same function", () => {
    const emitter = new Emitter();
    const fn = vi.fn();
    emitter.on("e", fn);
    emitter.on("e", fn);
    emitter.emit("e");
    // Set prevents duplicates
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
