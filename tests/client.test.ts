import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import type { PlatformAdapter, UniversalWebSocket } from "../src/platform/types";
import { WS_READY_STATE } from "../src/platform/types";

interface MockWs extends UniversalWebSocket {
  url: string;
}

const mockWsInstances: MockWs[] = [];

function createMockWs(url: string): MockWs {
  const ws: MockWs = {
    readyState: WS_READY_STATE.CONNECTING,
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    close: vi.fn(),
    send: vi.fn(),
    url,
  };
  mockWsInstances.push(ws);
  return ws;
}

const mockAdapter: PlatformAdapter = {
  createWebSocket: (url: string) => createMockWs(url),
  dataToString: (data: unknown) => {
    if (typeof data === "string") return data;
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
    if (data instanceof Uint8Array) return new TextDecoder().decode(data);
    if (Buffer.isBuffer(data)) return data.toString("utf-8");
    return null;
  },
  supportsPing: false,
  ping: vi.fn(),
  removeAllListeners: (ws: UniversalWebSocket) => {
    ws.onopen = null;
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
  },
};

vi.mock("../src/platform/index", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/platform/index")>();
  return {
    ...actual,
    getPlatformAdapter: () => mockAdapter,
  };
});

import { WebSocketClient } from "../src/WebSocketClient";

describe("WebSocketClient", () => {
  beforeEach(() => {
    mockWsInstances.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createClient(
    options?: Partial<ConstructorParameters<typeof WebSocketClient>[0]>
  ): WebSocketClient {
    return new WebSocketClient({
      service: "wss://test.example.com",
      logger: { enabled: false },
      ...options,
    });
  }

  function lastWs(): MockWs {
    return mockWsInstances[mockWsInstances.length - 1];
  }

  it("connects and emits open event", () => {
    const client = createClient();
    const onOpen = vi.fn();
    client.on("open", onOpen);

    client.connect();
    const ws = lastWs();
    ws.readyState = WS_READY_STATE.OPEN;
    ws.onopen!({});

    expect(onOpen).toHaveBeenCalled();
  });

  it("emits close event with code and reason", () => {
    const client = createClient();
    const onClose = vi.fn();
    client.on("close", onClose);

    client.connect();
    const ws = lastWs();
    ws.readyState = WS_READY_STATE.OPEN;
    ws.onopen!({});
    ws.readyState = WS_READY_STATE.CLOSED;
    ws.onclose!({ code: 1000, reason: "normal" });

    expect(onClose).toHaveBeenCalledWith({ code: 1000, reason: "normal" });
  });

  it("emits error event on connection error", () => {
    const client = createClient();
    const onError = vi.fn();
    client.on("error", onError);

    client.connect();
    const ws = lastWs();
    ws.onerror!(new Error("connection failed"));

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("routes messages through handlers", async () => {
    const client = createClient();
    const schema = z.object({ type: z.literal("trade"), price: z.number() });
    const handler = vi.fn();

    client.handle(schema, handler);
    client.connect();

    const ws = lastWs();
    ws.readyState = WS_READY_STATE.OPEN;
    ws.onopen!({});

    // Simulate incoming message — adapter extracts data from MessageEvent-like object
    ws.onmessage!({ data: JSON.stringify({ type: "trade", price: 42.5 }) });

    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { type: "trade", price: 42.5 },
        })
      );
    });
  });

  it("send() serializes objects as JSON", () => {
    const client = createClient();
    client.connect();

    const ws = lastWs();
    ws.readyState = WS_READY_STATE.OPEN;
    ws.onopen!({});

    const result = client.send({ action: "subscribe", channel: "trades" });

    expect(result).toBe(true);
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ action: "subscribe", channel: "trades" })
    );
  });

  it("send() passes strings through unchanged", () => {
    const client = createClient();
    client.connect();

    const ws = lastWs();
    ws.readyState = WS_READY_STATE.OPEN;
    ws.onopen!({});

    client.send("raw string");
    expect(ws.send).toHaveBeenCalledWith("raw string");
  });

  it("send() returns false when not connected", () => {
    const client = createClient();
    const result = client.send("data");
    expect(result).toBe(false);
  });

  it("close() stops the connection", () => {
    const client = createClient();
    client.connect();

    const ws = lastWs();
    ws.readyState = WS_READY_STATE.OPEN;
    ws.onopen!({});

    client.close();
    expect(ws.close).toHaveBeenCalled();
  });

  it("getConnectionInfo() returns current state", () => {
    const client = createClient();
    const info = client.getConnectionInfo();
    expect(info.state).toBe("closed");
    expect(info.currentService).toBe("wss://test.example.com");
  });

  it("handle() returns this for chaining", () => {
    const client = createClient();
    const schema = z.object({ type: z.string() });
    const result = client.handle(schema, () => {});
    expect(result).toBe(client);
  });

  it("emits router errors as error events", async () => {
    const client = createClient();
    const onError = vi.fn();
    client.on("error", onError);

    client.connect();
    const ws = lastWs();
    ws.readyState = WS_READY_STATE.OPEN;
    ws.onopen!({});

    // Send invalid JSON to trigger router error
    ws.onmessage!({ data: "not json!" });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          rawData: "not json!",
        })
      );
    });
  });
});
