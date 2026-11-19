import type {
  PuckAiModel,
  PuckAiProviderOptions,
} from "@puckeditor/cloud-client";
import type { z } from "zod/v4";

/** An API apps read data from, such as a list of orders. */
export type ReadApi = {
  /** What the API returns, so the AI knows when to use it. */
  description: string;
  /** A readable name, such as "Orders". Defaults to its key, in sentence case. */
  label?: string;
  /** What apps may send, such as filters. Defaults to no input. */
  input?: z.ZodObject;
  /** What the API returns. Fields it doesn't declare never reach the app. */
  output: z.ZodType;
};

/** An API apps change data with, such as closing a ticket. */
export type WriteApi = {
  /** What the API does, so the AI knows when to use it. */
  description: string;
  /** A readable name, such as "Refund order". Defaults to its key, in sentence case. */
  label?: string;
  /** What apps must send. The server checks it before your handler runs. */
  input: z.ZodObject;
  /** What the API returns. Defaults to nothing. */
  output?: z.ZodType;
  /** A question to confirm with the user before every call, such as "Refund this order?". */
  confirm?: string;
};

/** How the AI builds apps. */
export type AiRules = {
  /**
   * What the AI should know about your business and the people using the
   * apps, such as who they are and what matters to them.
   */
  context?: string;
  /**
   * How every component the AI designs must look and behave: your design
   * system, in words. Name the CSS variables your app frame sets, and give
   * sizes, colours and parts, such as buttons and tables.
   */
  designRules?: string;
  /**
   * Let the AI call your read APIs while it builds, so it designs around real
   * data. Defaults to false, so the AI only sees what the APIs return.
   */
  readData?: boolean;
  /** The AI model, such as "openai/gpt-5.6-luna". Defaults to Puck's. */
  model?: PuckAiModel;
  /** How many steps the AI may take for each prompt. Capped at 50. */
  maxIterations?: number;
  /** Options for the model's provider, such as how hard it reasons. */
  providerOptions?: PuckAiProviderOptions;
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
