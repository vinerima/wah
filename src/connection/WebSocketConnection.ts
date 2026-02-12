import { EventEmitter } from "events";
import WebSocket from "ws";
import { ConnectionOptions, ConnectionInfo, ConnectionState, ReconnectOptions } from "./types";
import { Logger } from "../logger/Logger";

/**
 * Manages the WebSocket connection lifecycle including connecting, reconnecting
 * with exponential backoff, multi-service failover, heartbeat pings, and
 * dynamic query parameter updates.
 *
 * Events emitted:
 * - `"open"` — connection established
 * - `"close"` — connection closed (emits `{ code: number, reason: string }`)
 * - `"error"` — connection error (emits the `Error` object)
 * - `"message"` — message received (emits the raw `WebSocket.Data`)
 * - `"reconnecting"` — about to attempt reconnection (emits `{ attempt, maxAttempts, delay, service }`)
 * - `"serviceSwitched"` — failed over to a different service URL (emits `{ from, to, cycle }`)
 */
export class WebSocketConnection extends EventEmitter {
  private services: string[];
  private queryParams: Record<string, string | number | boolean>;
  private reconnectConfig: Required<ReconnectOptions>;
  private pingInterval: number;

  private ws: WebSocket | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private serviceIndex = 0;
  private reconnectAttempts = 0;
  private serviceCycles = 0;
  private isConnecting = false;
  private shouldReconnect = true;
  private messageCount = 0;
  private lastMessageTime = 0;

  private logger: Logger;

  constructor(options: ConnectionOptions, logger: Logger) {
    super();
    this.services = Array.isArray(options.service) ? options.service : [options.service];
    this.queryParams = { ...options.queryParams };
    this.pingInterval = options.pingInterval ?? 10000;
    this.logger = logger;

    const rc = options.reconnect ?? {};
    this.reconnectConfig = {
      initialDelay: rc.initialDelay ?? 5000,
      maxDelay: rc.maxDelay ?? 30000,
      backoffFactor: rc.backoffFactor ?? 1.5,
      maxAttempts: rc.maxAttempts ?? 3,
      maxServiceCycles: rc.maxServiceCycles ?? 2,
    };
  }

  /**
   * Opens the WebSocket connection. Does nothing if already connecting or connected.
   */
  connect(): void {
    if (this.isConnecting || this.getState() === "connected") {
      this.logger.debug("Connect called but already connecting/connected");
      return;
    }
    this.shouldReconnect = true;
    this.run();
  }

  /**
   * Closes the WebSocket connection gracefully and stops all reconnection attempts.
   */
  close(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        this.logger.error("Error closing WebSocket", error);
      }
    }
  }

  /**
   * Sends raw data through the WebSocket.
   * @returns `true` if the data was sent, `false` if the connection is not open.
   */
  send(data: string | Buffer): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(data);
        return true;
      } catch (error) {
        this.logger.error("Error sending data", error);
        return false;
      }
    }
    this.logger.debug("Cannot send: WebSocket not connected");
    return false;
  }

  /**
   * Merges new query parameters into the current set and reconnects
   * so the updated URL takes effect.
   */
  updateParams(params: Record<string, string | number | boolean>): void {
    this.queryParams = { ...this.queryParams, ...params };
    this.logger.info("Query params updated, reconnecting", { params: this.queryParams });

    // Graceful reconnect: close current, then re-run
    this.cleanup();
    this.reconnectAttempts = 0;
    this.serviceCycles = 0;
    this.run();
  }

  /**
   * Returns a read-only snapshot of the current connection state.
   */
  getConnectionInfo(): ConnectionInfo {
    return {
      state: this.getState(),
      currentService: this.getCurrentServiceUrl(),
      serviceIndex: this.serviceIndex,
      allServices: [...this.services],
      reconnectAttempts: this.reconnectAttempts,
      serviceCycles: this.serviceCycles,
      messageCount: this.messageCount,
      lastMessageTime: this.lastMessageTime,
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private getState(): ConnectionState {
    if (!this.ws) return "closed";
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return "connected";
      case WebSocket.CLOSING:
        return "closing";
      default:
        return "closed";
    }
  }

  private getCurrentServiceUrl(): string {
    return this.buildUrl(this.services[this.serviceIndex]);
  }

  private buildUrl(base: string): string {
    if (Object.keys(this.queryParams).length === 0) {
      return base;
    }

    const url = new URL(base);
    for (const [key, value] of Object.entries(this.queryParams)) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private run(): void {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const serviceUrl = this.getCurrentServiceUrl();

    try {
      this.logger.info("Connecting to WebSocket", { service: serviceUrl });
      this.ws = new WebSocket(serviceUrl);

      this.ws.on("open", () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.serviceCycles = 0;
        this.startHeartbeat();
        this.logger.info("WebSocket connected", { service: serviceUrl });
        this.emit("open");
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.messageCount++;
        this.lastMessageTime = Date.now();
        this.emit("message", data);
      });

      this.ws.on("error", (error: Error) => {
        this.logger.error("WebSocket error", error);
        this.isConnecting = false;
        this.emit("error", error);
      });

      this.ws.on("close", (code: number, reason: Buffer) => {
        const reasonStr = reason.toString();
        this.logger.info("WebSocket disconnected", { code, reason: reasonStr });
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit("close", { code, reason: reasonStr });

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });
    } catch (error) {
      this.logger.error("Error creating WebSocket", error);
      this.isConnecting = false;
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;

    if (this.reconnectAttempts >= this.reconnectConfig.maxAttempts) {
      if (this.canTryNextService()) {
        this.moveToNextService();
        return;
      }
      this.logger.error("All services exhausted", {
        totalServices: this.services.length,
        maxCycles: this.reconnectConfig.maxServiceCycles,
        completedCycles: this.serviceCycles,
      });
      return;
    }

    const delay = Math.min(
      this.reconnectConfig.initialDelay *
        Math.pow(this.reconnectConfig.backoffFactor, this.reconnectAttempts - 1),
      this.reconnectConfig.maxDelay
    );

    this.logger.info("Scheduling reconnection", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.reconnectConfig.maxAttempts,
      delay: `${Math.round(delay)}ms`,
      service: this.getCurrentServiceUrl(),
    });

    this.emit("reconnecting", {
      attempt: this.reconnectAttempts,
      maxAttempts: this.reconnectConfig.maxAttempts,
      delay: Math.round(delay),
      service: this.getCurrentServiceUrl(),
    });

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.cleanup();
      this.run();
    }, delay);
  }

  private canTryNextService(): boolean {
    return this.services.length > 1 && this.serviceCycles < this.reconnectConfig.maxServiceCycles;
  }

  private moveToNextService(): void {
    const previousIndex = this.serviceIndex;
    this.serviceIndex = (this.serviceIndex + 1) % this.services.length;

    if (this.serviceIndex === 0) {
      this.serviceCycles++;
    }

    this.reconnectAttempts = 0;

    const from = this.services[previousIndex];
    const to = this.services[this.serviceIndex];
    this.logger.info("Switching service", { from, to, cycle: this.serviceCycles });
    this.emit("serviceSwitched", { from, to, cycle: this.serviceCycles });

    this.cleanup();
    this.run();
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        try {
          this.ws.close();
        } catch {
          // Swallow — we're cleaning up anyway
        }
      }
      this.ws = null;
    }
    this.clearReconnectTimer();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.ping();
        } catch (error) {
          this.logger.error("Error sending ping", error);
        }
      }
    }, this.pingInterval);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
