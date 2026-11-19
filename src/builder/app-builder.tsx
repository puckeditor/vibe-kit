"use client";

import "@puckeditor/core/puck.css";
import { useMemo } from "react";
import { Puck, fieldsPlugin } from "@puckeditor/core";
import { createAiPlugin, withDynamicConfig } from "@puckeditor/plugin-ai";
import { createAuthPlugin } from "@puckeditor/plugin-auth";
import { createPagesPlugin } from "@puckeditor/plugin-pages";
import { createAppConfig, type AppFrame } from "../client/app-config";
import { createVibeKitPlugin } from "../client/create-vibe-kit-plugin";
import { VibeKitProvider } from "../client/provider";
import type { VibeKit } from "../types";
import {
  createInitialPromptPlugin,
  type InitialPrompt,
} from "./initial-prompt";
import { sendPrompt } from "./send-prompt";

/**
 * Show the editor where people build an app by describing it: the AI chat on
 * the left, and the live app filling the rest.
 *
 * The AI designs every component, to the kit's design rules, and the app
 * works as it will once published. Writes only check their input here, so
 * trying an app's actions while building it changes nothing.
 *
 * Needs `createVibeKitHandler` serving `/api/puck`, for the AI, saving and
 * publishing apps, and signing in.
 *
 * @param props.kit The kit, from `defineVibeKit`.
 * @param props.frame Your layout around every app. Defaults to none.
 * @param props.examplePrompts Prompts the chat suggests, such as "Add a table of open orders".
 * @param props.initialPrompt A prompt to send once the app loads, such as the
 *   one it was created with.
 * @param props.siteUrl Where published apps run, for the editor's "View page"
 *   link. Defaults to `/apps`.
 * @returns The editor.
 */
export function AppBuilder({
  kit,
  frame,
  examplePrompts = [],
  initialPrompt,
  siteUrl = "/apps",
}: {
  kit: VibeKit;
  frame?: AppFrame;
  examplePrompts?: string[];
  initialPrompt?: InitialPrompt;
  siteUrl?: string;
}) {
  // The AI adds the components it designs to the config as it goes
  const config = useMemo(
    () => withDynamicConfig(createAppConfig(frame), { root: {}, content: [] }),
    [frame],
  );

  const plugins = useMemo(
    () => [
      // Design mode, without a toggle: there are no components to assemble
      createAiPlugin({
        defaultMode: "design",
        chat: {
          examplePrompts: examplePrompts.map((label) => ({
            label,
            onClick: () => sendPrompt(label),
          })),
        },
      }),
      // The app's name, in the plugin bar beside the chat
      fieldsPlugin({ desktopSideBar: "left" }),
      createPagesPlugin({ siteUrl }),
      createAuthPlugin(),
      // Gives designed scripts in the preview `vibeKit`
      createVibeKitPlugin(),
      ...(initialPrompt ? [createInitialPromptPlugin(initialPrompt)] : []),
    ],
    [examplePrompts, initialPrompt, siteUrl],
  );

  return (
    <VibeKitProvider kit={kit} dryRun>
      <Puck
        config={config}
        data={{}}
        plugins={plugins}
        ui={{ plugin: { current: "ai" }, previewMode: "interactive" }}
        _experimentalFullScreenCanvas
      />
    </VibeKitProvider>
  );
}
