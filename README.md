# wah

Generic WebSocket action handler for TypeScript. Connect to any WebSocket, define message schemas with [Zod](https://zod.dev), and dispatch to typed handlers.

## Features

- **Schema-matched handlers** — Register Zod schemas with handler functions. Incoming messages are validated at runtime, and all matching handlers are invoked with fully typed data.
- **Multi-service failover** — Provide multiple WebSocket URLs. On connection failure, wah cycles through them with exponential backoff.
- **Dynamic query parameters** — Update URL query parameters at runtime. The connection gracefully reconnects with the new URL.
- **Bidirectional communication** — Handlers receive a `send()` function to reply through the same WebSocket.
- **Error isolation** — Handler errors are emitted as events, never crash the connection.
- **Configurable logging** — Built-in logger with log levels, or bring your own.

## Installation

```bash
pnpm add wah
```

## Quick Start

```typescript
import { WebSocketClient, LogLevel } from "wah";
import { z } from "zod";

// Define message schemas
const tradeSchema = z.object({
  type: z.literal("trade"),
  symbol: z.string(),
  price: z.number(),
  volume: z.number(),
});

const systemSchema = z.object({
  type: z.literal("system"),
  code: z.number(),
  message: z.string(),
});

// Create client
const client = new WebSocketClient({
  service: "wss://stream.example.com/v1",
  queryParams: { apiKey: "abc123", symbols: "BTC,ETH" },
  logger: { enabled: true, level: LogLevel.DEBUG },
});

// Register handlers — data is fully typed via z.infer
client.handle(tradeSchema, async ({ data, send }) => {
  console.log(`${data.symbol}: $${data.price} (vol: ${data.volume})`);
  send({ type: "ack", symbol: data.symbol });
});

client.handle(systemSchema, ({ data }) => {
  console.log(`System [${data.code}]: ${data.message}`);
});

// Subscribe to events
client.on("open", () => console.log("Connected"));
client.on("close", info => console.log("Disconnected", info));
client.on("error", err => console.error("Error:", err));
client.on("reconnecting", info => console.log("Reconnecting:", info));

// Connect
client.connect();

// Update query params (triggers reconnect with new URL)
client.updateParams({ symbols: "BTC,ETH,SOL" });

// Send data
client.send({ action: "subscribe", channel: "orderbook" });

// Close
client.close();
```

## API Reference

### `WebSocketClient`

#### Constructor

```typescript
new WebSocketClient(options: WebSocketClientOptions)
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `service` | `string \| string[]` | — | WebSocket URL(s). Multiple URLs enable failover. |
| `queryParams` | `Record<string, string \| number \| boolean>` | `{}` | Query parameters appended to the URL. |
| `reconnect.initialDelay` | `number` | `5000` | Base delay (ms) before first reconnection attempt. |
| `reconnect.maxDelay` | `number` | `30000` | Maximum delay (ms) between attempts. |
| `reconnect.backoffFactor` | `number` | `1.5` | Multiplier applied after each failed attempt. |
| `reconnect.maxAttempts` | `number` | `3` | Max attempts per service before switching. |
| `reconnect.maxServiceCycles` | `number` | `2` | Max full cycles through all services. |
| `pingInterval` | `number` | `10000` | Heartbeat ping interval (ms). |
| `logger.enabled` | `boolean` | `true` | Enable/disable logging. |
| `logger.level` | `LogLevel` | `INFO` | Minimum log level. |
| `logger.custom` | `LoggerInterface` | — | Custom logger implementation. |

#### Methods

**`handle<T>(schema: ZodSchema<T>, handler: MessageHandler<T>): this`**

Registers a handler for messages matching the schema. Returns `this` for chaining.

**`connect(): void`**

Opens the WebSocket connection.

**`close(): void`**

Closes the connection and stops reconnection.

**`send(data: unknown): boolean`**

Sends data through the WebSocket. Objects are JSON-serialized. Returns `true` if sent.

**`updateParams(params: Record<string, string | number | boolean>): void`**

Merges new query parameters and reconnects.

**`getConnectionInfo(): ConnectionInfo`**

Returns a snapshot of the current connection state.

#### Events

| Event | Payload | Description |
|---|---|---|
| `"open"` | — | Connection established. |
| `"close"` | `{ code, reason }` | Connection closed. |
| `"error"` | `Error \| HandlerError` | Connection error or handler error. |
| `"reconnecting"` | `{ attempt, maxAttempts, delay, service }` | About to reconnect. |
| `"serviceSwitched"` | `{ from, to, cycle }` | Failed over to a different service URL. |

### `HandlerContext<T>`

Passed to every matched handler:

| Property | Type | Description |
|---|---|---|
| `data` | `T` | Validated, typed message data. |
| `rawData` | `string` | Original raw message string. |
| `send` | `(data: unknown) => boolean` | Send data back through the WebSocket. |
| `connection` | `ConnectionInfo` | Read-only connection state snapshot. |

### `LogLevel`

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}
```

## Multi-Service Failover

When multiple service URLs are provided, the reconnection strategy works as follows:

1. Try to reconnect to the current service up to `maxAttempts` times with exponential backoff
2. Switch to the next service URL, reset attempt counter
3. Cycle through all services up to `maxServiceCycles` times
4. Give up after all cycles are exhausted

```typescript
const client = new WebSocketClient({
  service: [
    "wss://primary.example.com/ws",
    "wss://secondary.example.com/ws",
    "wss://fallback.example.com/ws",
  ],
  reconnect: {
    maxAttempts: 3,
    initialDelay: 2000,
    backoffFactor: 2,
    maxServiceCycles: 3,
  },
});
```

## Custom Logger

Replace the built-in console logger with your own implementation:

```typescript
import { WebSocketClient, LoggerInterface } from "wah";

const myLogger: LoggerInterface = {
  debug: (msg, ctx) => myLoggingService.log("debug", msg, ctx),
  info: (msg, ctx) => myLoggingService.log("info", msg, ctx),
  warn: (msg, ctx) => myLoggingService.log("warn", msg, ctx),
  error: (msg, ctx) => myLoggingService.log("error", msg, ctx),
};

const client = new WebSocketClient({
  service: "wss://example.com/ws",
  logger: { custom: myLogger },
});
```

## License

MIT
