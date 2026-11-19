"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  type ReactNode,
} from "react";
import type { VibeKit } from "../types";
import { createClient, type VibeKitClient } from "./create-client";
import { createBridge, installBridge, type VibeKitBridge } from "./bridge";

type VibeKitContextValue = {
  kit: VibeKit;
  client: VibeKitClient;
  /** What scripts get as `window.vibeKit`. */
  bridge: VibeKitBridge;
};

const VibeKitContext = createContext<VibeKitContextValue | null>(null);

/**
 * Give the scripts of the components the AI designs the kit's APIs, as
 * `window.vibeKit`.
 *
 * `AppBuilder` and `AppView` already use it. Use it yourself only to build your
 * own editor: set `dryRun` so writes only check their input, and add
 * `createVibeKitPlugin()` so scripts in the editor's preview get `vibeKit` too.
 *
 * @param props.kit The kit, from `defineVibeKit`.
 * @param props.host Where `createVibeKitHandler` serves the APIs. Defaults to `/api/puck`.
 * @param props.dryRun Only check writes' input, without running them.
 * @param props.children The app.
 * @returns The provider.
 */
export function VibeKitProvider({
  kit,
  host = "/api/puck",
  dryRun = false,
  children,
}: {
  kit: VibeKit;
  host?: string;
  dryRun?: boolean;
  children: ReactNode;
}) {
  const client = useMemo(
    () => createClient({ kit, host: host.replace(/\/+$/, ""), dryRun }),
    [kit, host, dryRun],
  );
  const bridge = useMemo(() => createBridge(client), [client]);

  // A layout effect, so the bridge is there before scripts run in effects
  useLayoutEffect(() => installBridge(window, bridge), [bridge]);

  const value = useMemo(() => ({ kit, client, bridge }), [kit, client, bridge]);

  return (
    <VibeKitContext.Provider value={value}>{children}</VibeKitContext.Provider>
  );
}

/**
 * Get the kit and its client from the nearest `VibeKitProvider`.
 *
 * @returns The provider's value.
 * @throws Error outside a `VibeKitProvider`.
 */
export const useVibeKit = () => {
  const value = useContext(VibeKitContext);

  if (!value) throw new Error("Wrap the app in <VibeKitProvider>");

  return value;
};
