import type { ApiResponseBody } from "../types";
import { VIBE_KIT_HEADER } from "../lib/constants";

/**
 * Call one of the kit's API routes.
 *
 * @param url The route, such as `/api/puck/reads/listOrders`.
 * @param body The JSON body.
 * @returns The response body. Failed requests always have an `error`.
 */
export const postApi = async (
  url: string,
  body: unknown,
): Promise<ApiResponseBody> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", [VIBE_KIT_HEADER]: "1" },
      body: JSON.stringify(body),
    });
    const result: ApiResponseBody = await response.json().catch(() => ({}));

    if (response.ok) return result;

    return {
      ...result,
      error: result.error ?? `Request failed with status ${response.status}`,
    };
  } catch {
    return { error: "Couldn't reach the server" };
  }
};
