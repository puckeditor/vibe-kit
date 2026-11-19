import type { ApiResponseBody, VibeKit } from "../types";
import { stripEmpty } from "../lib/strip-empty";
import { postApi } from "./post-api";

// One flat shape, as unions on `ok` only narrow in strict mode.
export type WriteOutcome<T> = {
  ok: boolean;
  /** What the write returned. */
  data?: T;
  /** Set when the write only checked its input. */
  dryRun?: boolean;
  error?: string;
  /** What's wrong with the input, by path. */
  issues?: ApiResponseBody["issues"];
  /** Set when the user didn't confirm. */
  cancelled?: boolean;
};

/** Calls a kit's APIs, behind `window.vibeKit`. */
export type VibeKitClient = {
  /** Read once per name and input until a write changes data. */
  read: (name: string, input?: unknown) => Promise<ApiResponseBody>;
  write: <T = unknown>(
    name: string,
    input?: unknown,
  ) => Promise<WriteOutcome<T>>;
  /** Listen for writes that change data. Returns a function that stops. */
  subscribe: (listener: () => void) => () => void;
};

/**
 * Make a client for a kit's API routes.
 *
 * @param options.kit The kit.
 * @param options.host Where `createVibeKitHandler` serves the APIs.
 * @param options.dryRun Only check writes' input, without running them.
 * @returns The client.
 */
export const createClient = ({
  kit,
  host,
  dryRun,
}: {
  kit: VibeKit;
  host: string;
  dryRun: boolean;
}): VibeKitClient => {
  // Reads made since the last write that changed data
  const reads = new Map<string, Promise<ApiResponseBody>>();
  const listeners = new Set<() => void>();

  return {
    read: async (name, input) => {
      if (!Object.hasOwn(kit.reads, name)) {
        return { error: `There's no read API called "${name}".` };
      }

      const body = { input: stripEmpty(input) };
      const key = `${name}:${JSON.stringify(body)}`;
      let pending = reads.get(key);

      if (!pending) {
        pending = postApi(`${host}/reads/${encodeURIComponent(name)}`, body);
        reads.set(key, pending);
      }

      const response = await pending;

      // Read failures again next time, rather than keep the error
      if (response.error !== undefined && reads.get(key) === pending) {
        reads.delete(key);
      }

      return response;
    },

    write: async (name, input) => {
      if (!Object.hasOwn(kit.writes, name)) {
        return { ok: false, error: `There's no write API called "${name}".` };
      }

      const api = kit.writes[name];
      const parsed = api.input.safeParse(stripEmpty(input));

      if (!parsed.success) {
        return {
          ok: false,
          error: `Invalid input for ${name}`,
          issues: parsed.error.issues.map(({ path, message }) => ({
            path,
            message,
          })),
        };
      }

      if (api.confirm && !window.confirm(api.confirm)) {
        return { ok: false, error: "Cancelled", cancelled: true };
      }

      const response = await postApi(
        `${host}/writes/${encodeURIComponent(name)}`,
        { input: stripEmpty(input), dryRun },
      );

      if (response.error !== undefined) {
        return { ok: false, error: response.error, issues: response.issues };
      }

      if (!response.dryRun) {
        reads.clear();
        listeners.forEach((listener) => listener());
      }

      return {
        ok: true,
        data: response.data as never,
        dryRun: response.dryRun === true,
      };
    },

    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
