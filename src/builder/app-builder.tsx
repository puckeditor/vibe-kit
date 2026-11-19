"use client";

import { useMemo } from "react";
import { Puck, fieldsPlugin, type Config } from "@puckeditor/core";
import { createAiPlugin, withDynamicConfig } from "@puckeditor/plugin-ai";
import { createAuthPlugin } from "@puckeditor/plugin-auth";
import { createPagesPlugin } from "@puckeditor/plugin-pages";
import { createVibeKitPlugin } from "../client/create-vibe-kit-plugin";
import { VibeKitProvider } from "../client/provider";
import type { VibeKit } from "../types";
import {
  createInitialPromptPlugin,
  type InitialPrompt,
} from "./initial-prompt";
import { sendPrompt } from "./send-prompt";

/**
 * Show the editor where people build an app: Puck AI's chat and the fields
 * in the plugin bar, and the live app filling the rest.
 *
 * The chat stays in design mode when the kit's rules allow it, as apps have
 * no fixed components, and the app starts interactive, so it works as it
 * will once published. Writes only check their input here, so trying an
 * app's actions while building it changes nothing.
 *
 * Needs `createVibeKitHandler` serving Puck's routes, for the AI, pages and
 * Sign in with Puck.
 *
 * @param props.kit The kit, from `defineVibeKit`.
 * @param props.config The app frame: a root, and the components apps may use.
 * @param props.examplePrompts Prompts the chat suggests.
 * @param props.initialPrompt A prompt to send once the app loads.
 * @param props.siteUrl Where published apps run, for "View page". Defaults to `/apps`.
 * @returns The editor.
 */
export function AppBuilder({
  kit,
  config,
  examplePrompts = [],
  initialPrompt,
  siteUrl = "/apps",
}: {
  kit: VibeKit;
  config: Config;
  examplePrompts?: string[];
  initialPrompt?: InitialPrompt;
  siteUrl?: string;
}) {
  const designMode = !!kit.ai.designMode?.allowed;

  // Design mode adds the components the AI designs to the config as it goes.
  const editorConfig = useMemo(
    () =>
      designMode
        ? withDynamicConfig(config, { root: {}, content: [] })
        : config,
    [config, designMode],
  );

  const plugins = useMemo(
    () => [
      // No design mode toggle: the chat stays in the mode it starts in
      createAiPlugin({
        defaultMode: designMode ? "design" : "assembly",
        chat: {
          examplePrompts: examplePrompts.map((label) => ({
            label,
            onClick: () => sendPrompt(label),
          })),
        },
      }),
      // In the plugin bar, rather than a sidebar beside the app
      fieldsPlugin({ desktopSideBar: "left" }),
      createPagesPlugin({ siteUrl }),
      createAuthPlugin(),
      // Gives designed scripts in the preview `vibeKit`
      createVibeKitPlugin(),
      ...(initialPrompt ? [createInitialPromptPlugin(initialPrompt)] : []),
    ],
    [designMode, examplePrompts, initialPrompt, siteUrl],
  );

  return (
    <VibeKitProvider kit={kit} dryRun>
      <Puck
        config={editorConfig}
        data={{}}
        plugins={plugins}
        ui={{ plugin: { current: "ai" }, previewMode: "interactive" }}
        _experimentalFullScreenCanvas
      />
    </VibeKitProvider>
  );
}
