"use client";

import { useLayoutEffect, type ReactNode } from "react";
import type { Plugin } from "@puckeditor/core";
import { installBridge } from "./bridge";
import { useVibeKit } from "./provider";

/**
 * Put the provider's bridge on the editor preview's window, while it shows.
 *
 * @param props.document The preview's document.
 * @param props.children The preview.
 * @returns The preview.
 */
function PreviewBridge({
  document,
  children,
}: {
  document?: Document;
  children: ReactNode;
}) {
  const { bridge } = useVibeKit();

  // A layout effect, so the bridge is there before scripts run in effects
  useLayoutEffect(() => {
    const preview = document?.defaultView;

    return preview ? installBridge(preview, bridge) : undefined;
  }, [document, bridge]);

  return <>{children}</>;
}

/**
 * Make a Puck plugin that gives scripts in the editor's preview
 * `window.vibeKit`, as `VibeKitProvider` does for the rendered app.
 *
 * Use it inside an `VibeKitProvider`.
 *
 * @returns The plugin.
 */
export const createVibeKitPlugin = () =>
  ({
    name: "vibe-kit",
    overrides: {
      iframe: ({ document, children }) => (
        <PreviewBridge document={document}>{children}</PreviewBridge>
      ),
    },
  }) satisfies Plugin;
