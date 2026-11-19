import { tool, type PuckCloudOptions } from "@puckeditor/cloud-client";
import { z } from "zod/v4";
import type { VibeKit } from "../types";
import { describeFields } from "../lib/describe-schema";
import { allowsScripts, describeBridge } from "../lib/describe-bridge";

export type PuckAiOptions = NonNullable<PuckCloudOptions["ai"]>;

/**
 * Make a read's input schema for an AI tool.
 *
 * Puck AI requires every property of a tool's input, so optional inputs
 * accept null, letting the AI leave one out. `callApi` drops the nulls, then
 * checks the input against the read's own schema. Puck Cloud can't take
 * `anyOf` in a tool's input, so enums list null as a value and other inputs
 * use a nullable type.
 *
 * @param input The read's input schema.
 * @returns The tool's input schema.
 */
const toToolInput = (input?: z.ZodObject) => {
  const shape: Record<string, z.core.$ZodType> = {};

  for (const field of describeFields(input, "input")) {
    let schema: z.ZodType | undefined;

    if (field.required) {
      shape[field.name] = input!.shape[field.name];
      continue;
    }

    if (field.options) {
      schema = z.literal([...field.options, null]);
    } else if (field.type === "string") {
      schema = z.nullable(z.string());
    } else if (field.type === "number") {
      schema = z.nullable(z.number());
    } else if (field.type === "boolean") {
      schema = z.nullable(z.boolean());
    }

    // An optional list or object can't take null without `anyOf`, so the AI
    // doesn't get it
    if (schema) {
      shape[field.name] = field.description
        ? schema.describe(field.description)
        : schema;
    }
  }

  return z.object(shape);
};

/**
 * Turn a kit's AI rules into `puckHandler` AI options.
 *
 * Appends the kit's APIs to the context, tells design mode how scripts call
 * them when the rules allow scripts, and adds a tool per read API when the
 * rules allow `readData`.
 *
 * @param kit The kit.
 * @param params.description The kit's APIs, as `describeKit` describes them.
 * @param params.callRead Run a read for the AI, returning its data or
 *   throwing its error.
 * @returns The AI options.
 */
export const getAiOptions = (
  kit: VibeKit,
  {
    description,
    callRead,
  }: {
    description: string;
    callRead: (name: string, input: unknown) => Promise<unknown>;
  },
): PuckAiOptions => {
  const { context, readData, designMode, ...rules } = kit.ai;

  return {
    ...rules,
    context: [context, description].filter(Boolean).join("\n\n"),
    ...(designMode && {
      designMode: allowsScripts(kit)
        ? {
            ...designMode,
            instructions: [designMode.instructions, describeBridge(kit)]
              .filter(Boolean)
              .join("\n\n"),
          }
        : designMode,
    }),
    ...(readData && {
      tools: Object.fromEntries(
        Object.entries(kit.reads).map(([name, api]) => [
          name,
          tool({
            description: api.description,
            inputSchema: toToolInput(api.input),
            execute: (input) => callRead(name, input),
          }),
        ]),
      ),
    }),
  };
};
