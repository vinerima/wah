/**
 * Configuration for reconnection behavior.
 */
export interface ReconnectOptions {
  /** Base delay in ms before the first reconnection attempt. Default: `5000`. */
  initialDelay?: number;
  /** Maximum delay in ms between reconnection attempts (caps exponential backoff). Default: `30000`. */
  maxDelay?: number;
  /** Multiplier applied to the delay after each failed attempt. Default: `1.5`. */
  backoffFactor?: number;
  /** Maximum consecutive reconnection attempts per service URL before switching. Default: `3`. */
  maxAttempts?: number;
  /** Maximum number of full cycles through all service URLs before giving up. Default: `2`. */
  maxServiceCycles?: number;
}

/**
 * Configuration for the WebSocket connection layer.
 */
export interface ConnectionOptions {
  /** One or more WebSocket service URLs. When multiple are provided, the connection fails over between them. */
  service: string | string[];
  /** Query parameters appended to the service URL. Values are serialized via `URLSearchParams`. */
  queryParams?: Record<string, string | number | boolean>;
  /** Reconnection behavior configuration. */
  reconnect?: ReconnectOptions;
  /** Interval in ms for sending WebSocket ping frames to keep the connection alive. Default: `10000`. */
  pingInterval?: number;
}

/**
 * Possible states of a WebSocket connection.
 */
export type ConnectionState = "connecting" | "connected" | "closing" | "closed";

/**
 * Read-only snapshot of the current connection state.
 * Passed to handlers so they can inspect the connection without modifying it.
 */
export interface ConnectionInfo {
  /** Current connection state. */
  state: ConnectionState;
  /** The service URL currently in use (including query params). */
  currentService: string;
  /** Index of the current service in the service array. */
  serviceIndex: number;
  /** All configured service URLs. */
  allServices: string[];
  /** Number of consecutive reconnection attempts for the current service. */
  reconnectAttempts: number;
  /** Number of completed full cycles through all services. */
  serviceCycles: number;
  /** Total number of messages received since the connection was created. */
  messageCount: number;
  /** Unix timestamp (ms) of the last received message, or `0` if none received. */
  lastMessageTime: number;
}
