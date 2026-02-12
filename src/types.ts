import { ConnectionOptions } from "./connection/types";
import { LoggerOptions } from "./logger/Logger";

/**
 * Configuration options for {@link WebSocketClient}.
 * Combines connection settings with logger configuration.
 */
export interface WebSocketClientOptions extends ConnectionOptions {
  /** Logger configuration. When omitted, logging is enabled at INFO level. */
  logger?: LoggerOptions;
}
