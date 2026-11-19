import {
  puckCloud,
  puckHandler,
  type PuckCloudOptions,
  type PuckSignInIdentity,
} from "@puckeditor/cloud-client";
import type {
  VibeKit,
  ReadInput,
  ReadResult,
  WriteInput,
  WriteResult,
} from "../types";
import { describeKit } from "../lib/describe-kit";
import { VIBE_KIT_HEADER } from "../lib/constants";
import { callApi, type ApiHandler } from "./call-api";
import { getAiOptions } from "./get-ai-options";

/** Who's calling an API, by default: the Puck user signed in to your app. */
export type SessionContext = { user: PuckSignInIdentity };

/** Your implementation of each read API, keyed like the kit's reads. */
export type ReadHandlers<Kit extends VibeKit, Context> = {
  [Name in keyof Kit["reads"]]: (
    input: ReadInput<Kit["reads"][Name]>,
    context: Context,
  ) => ReadResult<Kit["reads"][Name]> | Promise<ReadResult<Kit["reads"][Name]>>;
};

/** Your implementation of each write API, keyed like the kit's writes. */
export type WriteHandlers<Kit extends VibeKit, Context> = {
  [Name in keyof Kit["writes"]]: (
    input: WriteInput<Kit["writes"][Name]>,
    context: Context,
  ) =>
    | WriteResult<Kit["writes"][Name]>
    | Promise<WriteResult<Kit["writes"][Name]>>;
};

export type VibeKitHandlerOptions<Kit extends VibeKit, Context> = {
  reads: ReadHandlers<Kit, Context>;
  writes: WriteHandlers<Kit, Context>;
  /**
   * Find who's calling an API, passed to your handlers. Return null to refuse
   * the call. Defaults to the Puck user signed in with Sign in with Puck.
   */
  context?: (request: Request) => Context | null | Promise<Context | null>;
  /**
   * Options for `puckHandler`, which serves the other routes: the AI, saving
   * apps and signing in. Defaults `auth` to Sign in with Puck. `ai` overrides
   * the options the kit's rules make, except that apps are always designed,
   * with scripts.
   */
  puck?: PuckCloudOptions;
};

const API_ROUTE = /^\/api\/puck\/(reads|writes)\/([^/]+)\/?$/;

/**
 * Get a record's own value, ignoring inherited keys like "constructor".
 *
 * @param record The record.
 * @param key The key.
 * @returns The value, or undefined.
 */
const own = <T>(record: Record<string, T>, key: string) =>
  Object.hasOwn(record, key) ? record[key] : undefined;

/**
 * Serve a kit's APIs and Puck's routes from one route handler.
 *
 * Serves `POST /api/puck/reads/:name` and `POST /api/puck/writes/:name`, which
 * check who's calling and the input, run your handler, then check its output.
 * A write with `dryRun: true` only checks the input. They refuse requests
 * without the header the kit's client sends, so scripts use `vibeKit`. Every
 * other route goes to `puckHandler`, with AI options made from the kit's rules.
 *
 * @param kit The kit, from `defineVibeKit`.
 * @param options.reads Your handler for each read API.
 * @param options.writes Your handler for each write API.
 * @param options.context Find who's calling. Defaults to the Sign in with
 *   Puck session.
 * @param options.puck Options for `puckHandler`.
 * @returns A function that answers a request.
 *
 * @example
 * const handler = createVibeKitHandler(kit, { reads, writes });
 *
 * export { handler as GET, handler as POST, handler as DELETE };
 */
export const createVibeKitHandler = <
  Kit extends VibeKit,
  Context = SessionContext,
>(
  kit: Kit,
  options: VibeKitHandlerOptions<Kit, Context>,
) => {
  const { puck = {} } = options;
  const reads = options.reads as Record<string, ApiHandler<Context>>;
  const writes = options.writes as Record<string, ApiHandler<Context>>;
  const description = describeKit(kit);

  const getContext =
    options.context ??
    (async (request: Request) => {
      const session = await puckCloud({
        apiKey: puck.apiKey,
        host: puck.host,
      }).auth.getSession(request);

      return (session ? { user: session.user } : null) as Context | null;
    });

  const serveApi = async (
    request: Request,
    kind: "reads" | "writes",
    name: string,
  ) => {
    if (request.method !== "POST") {
      return Response.json(
        { error: "Use POST" },
        { status: 405, headers: { allow: "POST" } },
      );
    }

    // Generated code must use `vibeKit`, which applies dry runs and confirmations
    if (request.headers.get(VIBE_KIT_HEADER) !== "1") {
      return Response.json(
        { error: "Call the kit's APIs with vibeKit, not fetch" },
        { status: 400 },
      );
    }

    const context = await getContext(request);

    if (!context) {
      return Response.json(
        { error: "Sign in to use this app" },
        { status: 401 },
      );
    }

    const api = own<VibeKit["reads" | "writes"][string]>(kit[kind], name);
    const handler = own(kind === "reads" ? reads : writes, name);

    if (!api || !handler) {
      return Response.json(
        {
          error: `Unknown ${kind === "reads" ? "read" : "write"} API: ${name}`,
        },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => null);
    const { status, body: result } = await callApi({
      name,
      api,
      handler,
      input: body?.input,
      context,
      dryRun: kind === "writes" && body?.dryRun === true,
    });

    return Response.json(result, {
      status,
      headers: { "cache-control": "no-store" },
    });
  };

  return async (request: Request): Promise<Response> => {
    const match = new URL(request.url).pathname.match(API_ROUTE);

    if (match) {
      try {
        return await serveApi(
          request,
          match[1] as "reads" | "writes",
          decodeURIComponent(match[2]),
        );
      } catch (error) {
        console.error("[vibe-kit] Couldn't serve", match[0], error);

        return Response.json(
          { error: "Something went wrong" },
          { status: 500 },
        );
      }
    }

    const ai = getAiOptions(kit, {
      description,
      callRead: async (name, input) => {
        const context = await getContext(request);
        const api = own(kit.reads, name);
        const handler = own(reads, name);

        if (!context || !api || !handler) {
          throw new Error(`Can't read ${name}`);
        }

        const { body } = await callApi({ name, api, handler, input, context });

        if (body.error) throw new Error(body.error);

        return body.data;
      },
    });

    return puckHandler(request, {
      auth: { provider: "puck" },
      ...puck,
      // Always design mode with scripts, as scripts are how apps reach data
      ai: {
        ...ai,
        ...puck.ai,
        mode: "design",
        designMode: { ...ai.designMode, ...puck.ai?.designMode, scripts: true },
      },
    });
  };
};
