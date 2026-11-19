type PuckAiWindow = Window & {
  __PUCK_AI?: {
    sendMessage: (message: {
      role: "user";
      parts: { type: "text"; text: string }[];
    }) => void;
  };
};

/**
 * Send a prompt to the AI plugin's chat, as if the user typed it.
 *
 * Uses `window.__PUCK_AI`, which the chat sets once it mounts. It's private,
 * as the AI plugin has no public way to send a prompt into its chat yet.
 *
 * @param text The prompt.
 * @returns Whether the chat was ready to take it.
 */
export const sendPrompt = (text: string) => {
  const chat = (window as PuckAiWindow).__PUCK_AI;

  chat?.sendMessage({ role: "user", parts: [{ type: "text", text }] });

  return !!chat;
};
