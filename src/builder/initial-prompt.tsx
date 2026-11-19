"use client";

import { useEffect, useRef } from "react";
import { createUsePuck, type Plugin } from "@puckeditor/core";
import { sendPrompt } from "./send-prompt";

const usePuck = createUsePuck();

/** A prompt to send once the editor holds the app it was written for. */
export type InitialPrompt = {
  /** The prompt. */
  prompt: string;
  /** The app's title, to tell when the editor holds it. */
  appTitle: string;
};

/**
 * Send the prompt the app was created with, once the app has loaded.
 *
 * Waits for the pages plugin to load the app, so the AI builds on it rather
 * than on the empty editor. Drops the prompt from the URL, so reloading
 * doesn't send it again.
 *
 * @param props.prompt The prompt.
 * @param props.appTitle The app's title, to tell when the editor holds it.
 * @returns Nothing.
 */
function SendInitialPrompt({ prompt, appTitle }: InitialPrompt) {
  // Puck starts with the default title, and the pages plugin empties the
  // editor while it loads, so only the app's own title means it's loaded.
  const loaded = usePuck((s) => s.appState.data.root.props?.title === appTitle);
  const sent = useRef(false);

  useEffect(() => {
    if (!loaded || sent.current) return;

    const interval = setInterval(() => {
      if (!sendPrompt(prompt)) return;

      sent.current = true;
      clearInterval(interval);

      const url = new URL(window.location.href);

      url.searchParams.delete("prompt");
      window.history.replaceState(null, "", url);
    }, 100);

    return () => clearInterval(interval);
  }, [prompt, loaded]);

  return null;
}

/**
 * Create a plugin that sends a prompt to the AI chat once the app loads.
 *
 * @param initialPrompt The prompt and the app it's for.
 * @returns The plugin.
 */
export const createInitialPromptPlugin = (
  initialPrompt: InitialPrompt,
): Plugin => ({
  name: "initial-prompt",
  overrides: {
    puck: ({ children }) => (
      <>
        {children}
        <SendInitialPrompt {...initialPrompt} />
      </>
    ),
  },
});
