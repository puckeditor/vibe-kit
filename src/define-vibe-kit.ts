import type { AiRules, VibeKit, ReadApi, WriteApi } from "./types";

/**
 * Define what apps may be built from: the APIs they read and write, and the
 * AI's rules.
 *
 * The kit holds schemas, not handlers, so import it on both the server and in
 * the browser: the server serves its APIs with `createVibeKitHandler`, and
 * apps call them by name.
 *
 * @param kit.reads The APIs apps read data from, keyed by name.
 * @param kit.writes The APIs apps change data with, keyed by name.
 * @param kit.ai How the AI builds apps: what it should know, and your design
 *   rules. Without them, it designs in its own style.
 * @returns The kit.
 */
export const defineVibeKit = <
  Reads extends Record<string, ReadApi> = {},
  Writes extends Record<string, WriteApi> = {},
>(kit: {
  reads?: Reads;
  writes?: Writes;
  ai?: AiRules;
}): VibeKit<Reads, Writes> => ({
  reads: kit.reads ?? ({} as Reads),
  writes: kit.writes ?? ({} as Writes),
  ai: kit.ai ?? {},
});
