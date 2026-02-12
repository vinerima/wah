import { z } from "zod";
import { ConnectionInfo } from "../connection/types";

/**
 * Context object passed to every matched handler.
 * Provides the validated message data, a send function for replies,
 * and read-only connection info.
 *
 * @typeParam T - The inferred type of the matched Zod schema.
 */
export interface HandlerContext<T> {
  /** The validated and typed message data. */
  data: T;
  /** The original raw message string before parsing. */
  rawData: string;
  /** Sends data back through the WebSocket. Returns `true` if sent, `false` if not connected. */
  send: (data: unknown) => boolean;
  /** Read-only snapshot of the current connection state. */
  connection: ConnectionInfo;
}

/**
 * A function that handles a message matching a specific schema.
 * Can be synchronous or asynchronous.
 *
 * @typeParam T - The inferred type of the matched Zod schema.
 */
export type MessageHandler<T> = (ctx: HandlerContext<T>) => void | Promise<void>;

/**
 * Internal registration entry pairing a Zod schema with its handler.
 */
export interface HandlerRegistration {
  schema: z.ZodSchema;
  handler: MessageHandler<unknown>;
}

/**
 * Error information emitted when a handler throws during execution.
 */
export interface HandlerError {
  /** The error thrown by the handler. */
  error: unknown;
  /** The raw message string that triggered the handler. */
  rawData: string;
  /** Unix timestamp (ms) when the error occurred. */
  timestamp: number;
}
