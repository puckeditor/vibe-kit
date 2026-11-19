"use client";

import { useState } from "react";

/**
 * Turn an app's name into its page path, such as "/ticket-triage".
 *
 * @param name The app's name.
 * @returns The path, or "/" when the name has no letters or digits.
 */
export const toAppPath = (name: string) =>
  `/${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;

/**
 * Create apps as Puck pages, titled with the app's name.
 *
 * Saves through `puckHandler`'s pages API, so the page is recorded as the
 * signed-in user's.
 *
 * @param host Where `createVibeKitHandler` serves Puck's routes. Defaults to `/api/puck`.
 * @returns `create`, which resolves to the new app's path, or undefined when
 *   it fails, with the reason in `error`, and whether a create is running.
 */
export function useCreateApp(host = "/api/puck") {
  const [error, setError] = useState<string>();
  const [isCreating, setIsCreating] = useState(false);

  const create = async ({
    name,
    prompt,
  }: {
    name: string;
    prompt: string;
  }): Promise<string | undefined> => {
    const path = toAppPath(name);

    if (path === "/") return void setError("Give your app a name.");
    if (!prompt.trim()) {
      return void setError("Describe what your app should do.");
    }

    setIsCreating(true);
    setError(undefined);

    const response = await fetch(`${host.replace(/\/+$/, "")}/pages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path,
        data: { root: { props: { title: name.trim() } }, content: [] },
      }),
    }).catch(() => null);

    if (!response?.ok) {
      const body = await response?.json().catch(() => null);

      setIsCreating(false);
      setError(
        response?.status === 400 && /exists/.test(body?.error ?? "")
          ? `There's already an app at ${path}. Choose another name.`
          : "Your app couldn't be created. Try again.",
      );

      return;
    }

    // Stays creating while the caller opens the app
    return path;
  };

  return { create, error, isCreating };
}
