"use client";

import { useCallback, useState } from "react";
import type { WriteOutcome } from "./create-client";
import { useVibeKit } from "./provider";

/**
 * Call one of the kit's write APIs.
 *
 * Checks the input against the write's schema before sending it, asks the user
 * to confirm when the write has a `confirm` question, then fetches every read
 * again once the write succeeds.
 *
 * @param name The write's name.
 * @returns `call(input)`, the write's API, whether a call is pending, and the
 *   last call's outcome. `reset()` clears the outcome.
 */
export function useWrite<T = unknown>(name: string | undefined) {
  const { kit, client } = useVibeKit();
  const api =
    name && Object.hasOwn(kit.writes, name) ? kit.writes[name] : undefined;
  const [state, setState] = useState<{
    isPending: boolean;
    outcome?: WriteOutcome<T>;
  }>({ isPending: false });

  const call = useCallback(
    async (input: Record<string, unknown> = {}): Promise<WriteOutcome<T>> => {
      if (!name) {
        const outcome = { ok: false, error: "Choose an action first." };

        setState({ isPending: false, outcome });

        return outcome;
      }

      setState((current) => ({ ...current, isPending: true }));

      const outcome = await client.write<T>(name, input);

      // Declining to confirm leaves the last outcome showing
      setState((current) =>
        outcome.cancelled
          ? { ...current, isPending: false }
          : { isPending: false, outcome },
      );

      return outcome;
    },
    [name, client],
  );

  const reset = useCallback(() => setState({ isPending: false }), []);

  return {
    call,
    reset,
    api,
    isPending: state.isPending,
    outcome: state.outcome,
  };
}
