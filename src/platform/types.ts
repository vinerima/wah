/**
 * Minimal WebSocket interface that both Node `ws` and the browser
 * native `WebSocket` satisfy.
 */
export interface UniversalWebSocket {
  readonly readyState: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onopen: ((event: any) => void) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onclose: ((event: any) => void) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror: ((event: any) => void) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onmessage: ((event: any) => void) | null;
  close(code?: number, reason?: string): void;
  send(data: string | ArrayBuffer | Uint8Array): void;
}

/** Ready-state constants shared by both Node ws and browser WebSocket. */
export const WS_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

/**
 * Abstracts the three platform-specific concerns:
 * WebSocket construction, binary-to-string conversion, and ping support.
 */
export interface PlatformAdapter {
  /** Creates a WebSocket connection to the given URL. */
  createWebSocket(url: string): UniversalWebSocket;

  /** Converts incoming message data to a UTF-8 string. */
  dataToString(data: unknown): string | null;

  /** Whether the platform supports sending ping frames. */
  readonly supportsPing: boolean;

  /** Sends a ping frame. No-op when `supportsPing` is false. */
  ping(ws: UniversalWebSocket): void;

  /** Removes all event handlers from a WebSocket instance. */
  removeAllListeners(ws: UniversalWebSocket): void;
}
