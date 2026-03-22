import type { PlatformAdapter } from "./types";
import { createNodeAdapter } from "./node";
import { createBrowserAdapter } from "./browser";

export type { PlatformAdapter, UniversalWebSocket } from "./types";
export { WS_READY_STATE } from "./types";
export { Emitter } from "./Emitter";

let cached: PlatformAdapter | null = null;

function isNode(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions !== "undefined" &&
    typeof process.versions.node !== "undefined"
  );
}

/**
 * Returns a platform adapter for the current runtime.
 * The result is cached — subsequent calls return the same instance.
 */
export function getPlatformAdapter(): PlatformAdapter {
  if (cached) return cached;
  cached = isNode() ? createNodeAdapter() : createBrowserAdapter();
  return cached;
}
