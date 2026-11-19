"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
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
  /** Goes up after every write that changes data, so reads fetch again. */
  version: number;
};

const VibeKitContext = createContext<VibeKitContextValue | null>(null);

/**
 * Give components access to the kit's APIs, for `useRead` and `useWrite`, and
 * scripts as `window.vibeKit`.
 *
 * Wrap both the editor and the rendered app in it. In the editor, set `dryRun`
 * so writes only check their input, and add `createVibeKitPlugin()` so scripts
 * in the preview get `vibeKit` too.
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
  const [version, setVersion] = useState(0);

  useEffect(
    () => client.subscribe(() => setVersion((current) => current + 1)),
    [client],
  );

  // A layout effect, so the bridge is there before scripts run in effects
  useLayoutEffect(() => installBridge(window, bridge), [bridge]);

  const value = useMemo(
    () => ({ kit, client, bridge, version }),
    [kit, client, bridge, version],
  );

  return (
    <VibeKitContext.Provider value={value}>{children}</VibeKitContext.Provider>
  );
}

/**
 * Get the kit and its client from the nearest `VibeKitProvider`.
 *
 * @returns The provider's value.
 * @throws Error outside an `VibeKitProvider`.
 */
export const useVibeKit = () => {
  const value = useContext(VibeKitContext);

  if (!value) throw new Error("Wrap the app in <VibeKitProvider>");

  return value;
};
