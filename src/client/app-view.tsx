"use client";

import { useMemo } from "react";
import { Render, type Data } from "@puckeditor/core";
import { withDynamicConfig } from "@puckeditor/plugin-ai";
import type { VibeKit } from "../types";
import { createAppConfig, type AppFrame } from "./app-config";
import { VibeKitProvider } from "./provider";

/**
 * Run a published app: the components the AI designed, in your frame, with
 * `window.vibeKit` so their scripts can call the kit's APIs.
 *
 * @param props.kit The kit, from `defineVibeKit`.
 * @param props.data The app, as Puck Cloud's pages API returns it.
 * @param props.frame Your layout around every app. Defaults to none.
 * @param props.host Where `createVibeKitHandler` serves the APIs. Defaults to `/api/puck`.
 * @returns The app.
 */
export function AppView({
  kit,
  data,
  frame,
  host,
}: {
  kit: VibeKit;
  data: Data;
  frame?: AppFrame;
  host?: string;
}) {
  // The AI's components live in the app's data, not in your config
  const config = useMemo(
    () => withDynamicConfig(createAppConfig(frame), data),
    [frame, data],
  );

  return (
    <VibeKitProvider kit={kit} host={host}>
      <Render config={config} data={data} />
    </VibeKitProvider>
  );
}
