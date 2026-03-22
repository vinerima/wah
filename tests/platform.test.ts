import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createNodeAdapter } from "../src/platform/node";
import { createBrowserAdapter } from "../src/platform/browser";

describe("Node adapter", () => {
  it("has supportsPing = true", () => {
    const adapter = createNodeAdapter();
    expect(adapter.supportsPing).toBe(true);
  });

  it("dataToString handles string input", () => {
    const adapter = createNodeAdapter();
    expect(adapter.dataToString("hello")).toBe("hello");
  });

  it("dataToString handles Buffer input", () => {
    const adapter = createNodeAdapter();
    const buf = Buffer.from("test", "utf-8");
    expect(adapter.dataToString(buf)).toBe("test");
  });

  it("dataToString handles ArrayBuffer input", () => {
    const adapter = createNodeAdapter();
    const ab = new TextEncoder().encode("ab").buffer;
    expect(adapter.dataToString(ab)).toBe("ab");
  });

  it("dataToString handles Buffer[] input", () => {
    const adapter = createNodeAdapter();
    const bufs = [Buffer.from("a"), Buffer.from("b")];
    expect(adapter.dataToString(bufs)).toBe("ab");
  });

  it("dataToString returns null for unsupported types", () => {
    const adapter = createNodeAdapter();
    expect(adapter.dataToString(123)).toBeNull();
  });

  it("ping calls ws.ping()", () => {
    const adapter = createNodeAdapter();
    const mockWs = { ping: vi.fn() } as unknown as Parameters<typeof adapter.ping>[0];
    adapter.ping(mockWs);
    expect((mockWs as unknown as { ping: ReturnType<typeof vi.fn> }).ping).toHaveBeenCalled();
  });

  it("removeAllListeners calls ws.removeAllListeners()", () => {
    const adapter = createNodeAdapter();
    const mockWs = { removeAllListeners: vi.fn() } as unknown as Parameters<
      typeof adapter.removeAllListeners
    >[0];
    adapter.removeAllListeners(mockWs);
    expect(
      (mockWs as unknown as { removeAllListeners: ReturnType<typeof vi.fn> }).removeAllListeners
    ).toHaveBeenCalled();
  });
});

describe("Browser adapter", () => {
  it("has supportsPing = false", () => {
    const adapter = createBrowserAdapter();
    expect(adapter.supportsPing).toBe(false);
  });

  it("dataToString handles string input", () => {
    const adapter = createBrowserAdapter();
    expect(adapter.dataToString("hello")).toBe("hello");
  });

  it("dataToString handles ArrayBuffer input", () => {
    const adapter = createBrowserAdapter();
    const ab = new TextEncoder().encode("test").buffer;
    expect(adapter.dataToString(ab)).toBe("test");
  });

  it("dataToString handles Uint8Array input", () => {
    const adapter = createBrowserAdapter();
    const u8 = new TextEncoder().encode("bytes");
    expect(adapter.dataToString(u8)).toBe("bytes");
  });

  it("dataToString returns null for unsupported types", () => {
    const adapter = createBrowserAdapter();
    expect(adapter.dataToString(42)).toBeNull();
  });

  it("ping is a no-op", () => {
    const adapter = createBrowserAdapter();
    // Should not throw
    adapter.ping({} as Parameters<typeof adapter.ping>[0]);
  });

  it("removeAllListeners nulls out property handlers", () => {
    const adapter = createBrowserAdapter();
    const mockWs = {
      onopen: () => {},
      onclose: () => {},
      onerror: () => {},
      onmessage: () => {},
    } as unknown as Parameters<typeof adapter.removeAllListeners>[0];

    adapter.removeAllListeners(mockWs);
    expect(mockWs.onopen).toBeNull();
    expect(mockWs.onclose).toBeNull();
    expect(mockWs.onerror).toBeNull();
    expect(mockWs.onmessage).toBeNull();
  });

  describe("createWebSocket", () => {
    const originalWebSocket = globalThis.WebSocket;

    beforeEach(() => {
      class MockWebSocket {
        readyState = 0;
        onopen: ((event: unknown) => void) | null = null;
        onclose: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onmessage: ((event: unknown) => void) | null = null;
        close = vi.fn();
        send = vi.fn();
        constructor(public url: string) {}
      }
      (globalThis as unknown as Record<string, unknown>).WebSocket = MockWebSocket;
    });

    afterEach(() => {
      (globalThis as unknown as Record<string, unknown>).WebSocket = originalWebSocket;
    });

    it("creates a WebSocket via globalThis.WebSocket", () => {
      const adapter = createBrowserAdapter();
      const ws = adapter.createWebSocket("wss://example.com");
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(0);
    });
  });
});

describe("getPlatformAdapter", () => {
  it("returns a Node adapter in Node.js", async () => {
    // Reset the cache by re-importing
    vi.resetModules();
    const { getPlatformAdapter } = await import("../src/platform/index");
    const adapter = getPlatformAdapter();
    expect(adapter.supportsPing).toBe(true);
  });

  it("caches the adapter", async () => {
    vi.resetModules();
    const { getPlatformAdapter } = await import("../src/platform/index");
    const a = getPlatformAdapter();
    const b = getPlatformAdapter();
    expect(a).toBe(b);
  });
});
