import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { WebSocketRouter } from "../src/router/WebSocketRouter";
import { Logger } from "../src/logger/Logger";
import type { ConnectionInfo } from "../src/connection/types";

function makeInfo(): ConnectionInfo {
  return {
    state: "connected",
    currentService: "wss://test.example.com",
    serviceIndex: 0,
    allServices: ["wss://test.example.com"],
    reconnectAttempts: 0,
    serviceCycles: 0,
    messageCount: 0,
    lastMessageTime: 0,
  };
}

describe("WebSocketRouter", () => {
  const logger = new Logger({ enabled: false });

  it("dispatches to a matching handler", async () => {
    const router = new WebSocketRouter(logger);
    const schema = z.object({ type: z.literal("ping") });
    const handler = vi.fn();
    router.register(schema, handler);

    const sendFn = vi.fn(() => true);
    await router.route(JSON.stringify({ type: "ping" }), sendFn, makeInfo());

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { type: "ping" },
        send: sendFn,
      })
    );
  });

  it("dispatches to multiple matching handlers", async () => {
    const router = new WebSocketRouter(logger);
    const schema1 = z.object({ type: z.string() });
    const schema2 = z.object({ type: z.literal("ping") });
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    router.register(schema1, handler1);
    router.register(schema2, handler2);

    await router.route(JSON.stringify({ type: "ping" }), vi.fn(() => true), makeInfo());

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it("does not dispatch when no schema matches", async () => {
    const router = new WebSocketRouter(logger);
    const schema = z.object({ type: z.literal("ping") });
    const handler = vi.fn();
    router.register(schema, handler);

    await router.route(JSON.stringify({ type: "pong" }), vi.fn(() => true), makeInfo());

    expect(handler).not.toHaveBeenCalled();
  });

  it("emits error on invalid JSON", async () => {
    const router = new WebSocketRouter(logger);
    const errorHandler = vi.fn();
    router.on("error", errorHandler);

    await router.route("not json!", vi.fn(() => true), makeInfo());

    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        rawData: "not json!",
      })
    );
  });

  it("emits error when a handler throws", async () => {
    const router = new WebSocketRouter(logger);
    const schema = z.object({ type: z.literal("boom") });
    const handlerError = new Error("handler failed");
    router.register(schema, () => {
      throw handlerError;
    });

    const errorHandler = vi.fn();
    router.on("error", errorHandler);

    await router.route(JSON.stringify({ type: "boom" }), vi.fn(() => true), makeInfo());

    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        error: handlerError,
        rawData: JSON.stringify({ type: "boom" }),
      })
    );
  });

  it("provides rawData and connection info in handler context", async () => {
    const router = new WebSocketRouter(logger);
    const schema = z.object({ v: z.number() });
    const handler = vi.fn();
    router.register(schema, handler);

    const info = makeInfo();
    const raw = JSON.stringify({ v: 42 });
    await router.route(raw, vi.fn(() => true), info);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { v: 42 },
        rawData: raw,
        connection: info,
      })
    );
  });
});
