import type { PlatformAdapter, UniversalWebSocket } from "./types";

interface WsWebSocket extends UniversalWebSocket {
  ping(): void;
  removeAllListeners(): void;
}

interface WsConstructor {
  new (url: string): WsWebSocket;
}

/**
 * Node.js platform adapter.
 * Uses the `ws` package for WebSocket and `Buffer` for binary conversion.
 */
export function createNodeAdapter(): PlatformAdapter {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WS = require("ws") as WsConstructor;

  return {
    createWebSocket(url: string): UniversalWebSocket {
      return new WS(url);
    },

    dataToString(data: unknown): string | null {
      if (typeof data === "string") return data;
      if (Buffer.isBuffer(data)) return data.toString("utf-8");
      if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf-8");
      if (Array.isArray(data)) return Buffer.concat(data).toString("utf-8");
      return null;
    },

    supportsPing: true,

    ping(ws: UniversalWebSocket): void {
      (ws as WsWebSocket).ping();
    },

    removeAllListeners(ws: UniversalWebSocket): void {
      (ws as WsWebSocket).removeAllListeners();
    },
  };
}
