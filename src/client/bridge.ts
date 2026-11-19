import type { ApiResponseBody } from "../types";
import type { VibeKitClient } from "./create-client";

/** The kit's APIs for scripts, as `window.vibeKit`. */
export type VibeKitBridge = {
  /**
   * Read data from a read API.
   *
   * @throws Error with the reason, and `issues` for invalid input.
   */
  read: <T = unknown>(
    name: string,
    input?: Record<string, unknown>,
  ) => Promise<T>;
  /**
   * Call a write API. In the editor, writes only check their input.
   *
   * @throws Error with the reason, `issues` for invalid input, and
   *   `cancelled` when the user declines to confirm.
   */
  write: <T = unknown>(
    name: string,
    input?: Record<string, unknown>,
  ) => Promise<{ data: T | null; dryRun: boolean }>;
  /** Call `callback` after every write that changes data. Returns a function that stops. */
  onChange: (callback: () => void) => () => void;
};

declare global {
  interface Window {
    vibeKit?: VibeKitBridge;
  }
}

/**
 * Make an error for a failed call.
 *
 * @param message The reason.
 * @param details.issues What's wrong with the input, by path.
 * @param details.cancelled Whether the user declined to confirm.
 * @returns The error.
 */
const callError = (
  message: string,
  details: { issues?: ApiResponseBody["issues"]; cancelled?: boolean },
) => Object.assign(new Error(message), details);

/**
 * Make the bridge scripts use to call a kit's APIs.
 *
 * @param client The provider's client, so scripts share its reads, dry runs
 *   and confirmations.
 * @returns The bridge.
 */
export const createBridge = (client: VibeKitClient): VibeKitBridge => ({
  read: async <T>(name: string, input: Record<string, unknown> = {}) => {
    const response = await client.read(name, input);

    if (response.error !== undefined) {
      throw callError(response.error, { issues: response.issues });
    }

    return response.data as T;
  },

  write: async <T>(name: string, input: Record<string, unknown> = {}) => {
    const outcome = await client.write<T>(name, input);

    if (!outcome.ok) {
      throw callError(outcome.error ?? `${name} failed`, {
        issues: outcome.issues,
        cancelled: outcome.cancelled,
      });
    }

    return { data: outcome.data ?? null, dryRun: outcome.dryRun === true };
  },

  onChange: (callback) =>
    client.subscribe(() => {
      try {
        callback();
      } catch (error) {
        console.error("[vibe-kit] An onChange callback failed", error);
      }
    }),
});

/**
 * Put a bridge on a window as `vibeKit`.
 *
 * @param target The window, such as the editor preview's.
 * @param bridge The bridge.
 * @returns A function that removes it, unless another bridge replaced it.
 */
export const installBridge = (target: Window, bridge: VibeKitBridge) => {
  target.vibeKit = bridge;

  return () => {
    if (target.vibeKit === bridge) delete target.vibeKit;
  };
};
