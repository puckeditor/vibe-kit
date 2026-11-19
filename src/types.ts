import type { PuckCloudOptions } from "@puckeditor/cloud-client";
import type { z } from "zod/v4";

/** An API apps read data from, such as a list of orders. */
export type ReadApi = {
  /** What the API returns, for the AI and the editor. */
  description: string;
  /** The API's name in the editor. Defaults to its key, in sentence case. */
  label?: string;
  /** What apps may send, such as filters. Defaults to no input. */
  input?: z.ZodObject;
  /** What the API returns. Fields it doesn't declare never reach the app. */
  output: z.ZodType;
};

/** An API apps change data with, such as closing a ticket. */
export type WriteApi = {
  /** What the API does, for the AI and the editor. */
  description: string;
  /** The API's name in the editor. Defaults to its key, in sentence case. */
  label?: string;
  /** What apps must send. The server checks it before your handler runs. */
  input: z.ZodObject;
  /** What the API returns. Defaults to nothing. */
  output?: z.ZodType;
  /** A question to confirm with the user before every call, such as "Refund this order?". */
  confirm?: string;
};

type PuckAiOptions = NonNullable<PuckCloudOptions["ai"]>;

/**
 * How the AI may build apps. Takes the `puckHandler` AI options that set
 * policy, such as `designMode.allowed` and `designMode.scripts`.
 */
export type AiRules = Pick<
  PuckAiOptions,
  "context" | "designMode" | "maxIterations" | "model" | "providerOptions"
> & {
  /**
   * Let the AI call read APIs while it builds, so it sees real data. Defaults
   * to false, so the AI only sees what the APIs return, not the data.
   */
  readData?: boolean;
};

/** What apps may be built from: the APIs they read and write, and the AI's rules. */
export type VibeKit<
  Reads extends Record<string, ReadApi> = Record<string, ReadApi>,
  Writes extends Record<string, WriteApi> = Record<string, WriteApi>,
> = {
  reads: Reads;
  writes: Writes;
  ai: AiRules;
};

/** A read's input, as your handler receives it. */
export type ReadInput<Api extends ReadApi> = Api["input"] extends z.ZodObject
  ? z.output<Api["input"]>
  : Record<string, never>;

/** A read's result, as your handler returns it. */
export type ReadResult<Api extends ReadApi> = z.input<Api["output"]>;

/** A write's input, as your handler receives it. */
export type WriteInput<Api extends WriteApi> = z.output<Api["input"]>;

/** A write's result, as your handler returns it. */
export type WriteResult<Api extends WriteApi> = Api["output"] extends z.ZodType
  ? z.input<Api["output"]>
  : unknown;

/** An API call's result, as `POST /api/puck/reads/:name` and `/writes/:name` send it. */
export type ApiResponseBody = {
  data?: unknown;
  error?: string;
  /** What's wrong with the input, by path. */
  issues?: { path: PropertyKey[]; message: string }[];
  /** Set when a write only checked its input. */
  dryRun?: boolean;
};
