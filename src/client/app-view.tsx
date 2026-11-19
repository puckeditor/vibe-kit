"use client";

import { useMemo } from "react";
import { Render, type Config, type Data } from "@puckeditor/core";
import type { VibeKit } from "../types";
import { applyRules } from "./apply-rules";
import { VibeKitProvider } from "./provider";

/**
 * Run a published app, under the kit's rules.
 *
 * @param props.kit The kit, from `defineVibeKit`.
 * @param props.config The app frame: a root, and the components apps may use.
 * @param props.data The app's published page.
 * @returns The app.
 */
export function AppView({
  kit,
  config,
  data,
}: {
  kit: VibeKit;
  config: Config;
  data: Data;
}) {
  const app = useMemo(() => applyRules(kit, config, data), [kit, config, data]);

  return (
    <VibeKitProvider kit={kit}>
      <Render config={app.config} data={app.data} />
    </VibeKitProvider>
  );
}
