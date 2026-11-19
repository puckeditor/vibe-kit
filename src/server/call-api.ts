import { z } from "zod/v4";
import type { ApiResponseBody, ReadApi, WriteApi } from "../types";
import { stripEmpty } from "../lib/strip-empty";
import { VibeKitError } from "./vibe-kit-error";

export type ApiResponse = { status: number; body: ApiResponseBody };

export type ApiHandler<Context> = (
  input: any,
  context: Context,
) => unknown | Promise<unknown>;

const noInput = z.object({});

/**
 * Check an API call's input, run its handler, and check what it returns.
 *
 * Only fields the API's output declares reach the caller.
 *
 * @param params.name The API's name, for errors.
 * @param params.api The read or write API.
 * @param params.handler Your handler for the API.
 * @param params.input The caller's input. Empty values are dropped.
 * @param params.context Who's calling, passed to the handler.
 * @param params.dryRun Check the input without running the handler.
 * @returns The status and body to answer with.
 */
export const callApi = async <Context>({
  name,
  api,
  handler,
  input,
  context,
  dryRun = false,
}: {
  name: string;
  api: ReadApi | WriteApi;
  handler: ApiHandler<Context>;
  input: unknown;
  context: Context;
  dryRun?: boolean;
}): Promise<ApiResponse> => {
  const parsed = (api.input ?? noInput).safeParse(stripEmpty(input));

  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: `Invalid input for ${name}`,
        issues: parsed.error.issues.map(({ path, message }) => ({
          path,
          message,
        })),
      },
    };
  }

  if (dryRun) return { status: 200, body: { data: null, dryRun: true } };

  let result: unknown;

  try {
    result = await handler(parsed.data, context);
  } catch (error) {
    if (error instanceof VibeKitError) {
      return { status: error.status, body: { error: error.message } };
    }

    console.error(`[vibe-kit] ${name} failed`, error);

    return { status: 500, body: { error: `${name} failed` } };
  }

  if (!api.output) return { status: 200, body: { data: null } };

  const output = api.output.safeParse(result);

  if (!output.success) {
    console.error(
      `[vibe-kit] ${name} returned data that doesn't match its output schema`,
      output.error.issues,
    );

    return {
      status: 500,
      body: {
        error: `${name} returned data that doesn't match its output schema`,
      },
    };
  }

  return { status: 200, body: { data: output.data } };
};
