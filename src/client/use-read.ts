"use client";

import { useEffect, useState } from "react";
import type { ApiResponseBody } from "../types";
import { stripEmpty } from "../lib/strip-empty";
import { useVibeKit } from "./provider";

export type ReadState<T> = {
  /** The read's data. Kept while a write makes it fetch again. */
  data?: T;
  error?: string;
  isLoading: boolean;
};

/**
 * Read data from one of the kit's read APIs.
 *
 * Reads with the same name and input share one request, with each other and
 * with scripts' `vibeKit.read`, and fetch again after every write.
 *
 * @param name The read's name. Reads nothing when empty.
 * @param input The read's input. Empty values are dropped.
 * @returns The data, error and loading state.
 */
export function useRead<T = unknown>(
  name: string | undefined,
  input?: Record<string, unknown>,
): ReadState<T> {
  const { kit, client, version } = useVibeKit();
  const known = !!name && Object.hasOwn(kit.reads, name);
  const body = JSON.stringify(stripEmpty(input));
  const request = `${name}:${body}`;
  const key = `${version}:${request}`;
  const [result, setResult] = useState<{
    key: string;
    request: string;
    response: ApiResponseBody;
  }>();

  useEffect(() => {
    if (!known) return;

    let current = true;

    client.read(name, JSON.parse(body)).then((response) => {
      if (current) setResult({ key, request, response });
    });

    return () => {
      current = false;
    };
  }, [known, name, body, key, request, client]);

  if (!name) return { isLoading: false };

  if (!known) {
    return {
      isLoading: false,
      error: `There's no read API called "${name}".`,
    };
  }

  const fresh = result?.request === request;

  return {
    data: fresh ? (result.response.data as T) : undefined,
    error: fresh ? result.response.error : undefined,
    isLoading: result?.key !== key,
  };
}
