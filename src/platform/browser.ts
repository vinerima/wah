import type { PlatformAdapter, UniversalWebSocket } from "./types";

const decoder = new TextDecoder();

/**
 * Browser platform adapter.
 * Uses the native `WebSocket` and `TextDecoder` for binary conversion.
 */
export function createBrowserAdapter(): PlatformAdapter {
  return {
    createWebSocket(url: string): UniversalWebSocket {
      return new WebSocket(url);
    },

    dataToString(data: unknown): string | null {
      if (typeof data === "string") return data;
      if (data instanceof ArrayBuffer) return decoder.decode(data);
      if (data instanceof Uint8Array) return decoder.decode(data);
      return null;
    },

    supportsPing: false,

    ping(): void {
      // Browser engines handle WebSocket keepalive at the protocol level.
    },

    removeAllListeners(ws: UniversalWebSocket): void {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
    },
  };
}
