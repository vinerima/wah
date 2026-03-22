export { WebSocketClient } from "./WebSocketClient";
export { WebSocketClientOptions } from "./types";

export { Logger, LogLevel } from "./logger/Logger";
export type { LoggerInterface, LoggerOptions } from "./logger/Logger";

export type {
  ConnectionOptions,
  ConnectionState,
  ConnectionInfo,
  ReconnectOptions,
} from "./connection/types";

export type {
  HandlerContext,
  MessageHandler,
  HandlerRegistration,
  HandlerError,
} from "./router/types";

export { Emitter } from "./platform/Emitter";
export { getPlatformAdapter } from "./platform/index";
export type { PlatformAdapter, UniversalWebSocket } from "./platform/types";
export { WS_READY_STATE } from "./platform/types";
