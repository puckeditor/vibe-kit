import type {} from "@puckeditor/ai-types";
import type { ArrayField, SelectField } from "@puckeditor/core";
import type { z } from "zod/v4";
import type { VibeKit, ReadApi } from "./types";
import {
  describeFields,
  getReadShape,
  humanize,
  type FieldDescriptor,
  type ReadShape,
} from "./lib/describe-schema";

type Option = SelectField["options"][number];

// Puck AI picks options by position, so an empty option goes last, keeping
// the others in the order the kit lists them.
const emptyOption = (label: string): Option => ({ label, value: "" });

/**
 * Find the kit's reads, optionally only those of one shape or one name.
 *
 * @param kit The kit.
 * @param filter.shape Only reads that return this shape.
 * @param filter.read Only this read, when the kit has it.
 * @returns The matching reads as `[name, api]` entries.
 */
const findReads = (
  kit: VibeKit,
  { shape, read }: { shape?: ReadShape; read?: string } = {},
): [string, ReadApi][] => {
  const reads = Object.entries(kit.reads).filter(
    ([, api]) => !shape || getReadShape(api) === shape,
  );
  const chosen = reads.filter(([name]) => name === read);

  return chosen.length ? chosen : reads;
};

/**
 * Make a field that binds a component to one of the kit's read APIs.
 *
 * The AI can only pick a read the kit declares. The AI's context describes
 * what each one returns.
 *
 * @param kit The kit.
 * @param options.label The field's label. Defaults to "Data".
 * @param options.shape Only offer reads that return rows ("list") or one
 *   record ("record").
 * @returns A select field whose value is the read's name.
 */
export const readField = (
  kit: VibeKit,
  { label = "Data", shape }: { label?: string; shape?: ReadShape } = {},
): SelectField => ({
  type: "select",
  label,
  options: findReads(kit, { shape }).map(([name, api]) => ({
    label: api.label ?? humanize(name),
    value: name,
  })),
  ai: {
    instructions:
      "The read API this component shows. See the Data APIs for what each returns.",
  },
});

/**
 * Make a field that binds a component to one of the kit's write APIs.
 *
 * @param kit The kit.
 * @param options.label The field's label. Defaults to "Action".
 * @param options.optional Add a "None" option, saved as `""`.
 * @returns A select field whose value is the write's name.
 */
export const writeField = (
  kit: VibeKit,
  { label = "Action", optional }: { label?: string; optional?: boolean } = {},
): SelectField => ({
  type: "select",
  label,
  options: [
    ...Object.entries(kit.writes).map(([name, api]) => ({
      label: api.label ?? humanize(name),
      value: name,
    })),
    ...(optional ? [emptyOption("None")] : []),
  ],
  ai: {
    instructions:
      "The write API this component calls. See the Data APIs for what each does and the input it takes.",
  },
});

/**
 * Make a field for picking a field of a read's result, such as a table column.
 *
 * Without `read`, it offers the fields of every read of the shape, so the AI
 * sees one fixed list. A field the reads label differently is labelled by its
 * name. Pass the chosen read from `resolveFields` to narrow the options, with
 * that read's labels, in the editor.
 *
 * @param kit The kit.
 * @param options.label The field's label. Defaults to "Field".
 * @param options.read The chosen read. Defaults to every read of the shape.
 * @param options.shape Only use reads of this shape.
 * @param options.type Only offer fields of this type, such as "number".
 * @param options.optional Add a "None" option, saved as `""`.
 * @returns A select field whose value is the field's name.
 */
export const keyField = (
  kit: VibeKit,
  {
    label = "Field",
    read,
    shape,
    type,
    optional,
  }: {
    label?: string;
    read?: string;
    shape?: ReadShape;
    type?: FieldDescriptor["type"];
    optional?: boolean;
  } = {},
): SelectField => {
  const fields = new Map<string, FieldDescriptor>();

  for (const [, api] of findReads(kit, { shape, read })) {
    for (const field of describeFields(api.output)) {
      if (type && field.type !== type) continue;

      const existing = fields.get(field.name);

      if (!existing) {
        fields.set(field.name, field);
      } else if (existing.label !== field.label) {
        fields.set(field.name, { ...existing, label: humanize(field.name) });
      }
    }
  }

  return {
    type: "select",
    label,
    options: [
      ...[...fields.values()].map((field) => ({
        label: field.label,
        value: field.name,
      })),
      ...(optional ? [emptyOption("None")] : []),
    ],
    ai: {
      instructions:
        "A field the chosen read API returns. Only use fields it lists.",
    },
  };
};

/** One fixed input for a read, as `inputField` stores it. */
export type InputValue = { name: string; value: string };

/**
 * Make a field for fixed input to a read, such as filters.
 *
 * Holds a list of name and value pairs, empty by default, so the AI only adds
 * input an app needs, using the names and values the read's input lists. Pass
 * the chosen read from `resolveFields` to offer its inputs as options in the
 * editor, and their values too when every input is an enum or boolean.
 *
 * @param kit The kit.
 * @param options.label The field's label. Defaults to "Filters".
 * @param options.read The chosen read, to offer its inputs as options.
 * @returns An array field. Pass its value to `pickReadInput`.
 */
export const inputField = (
  kit: VibeKit,
  { label = "Filters", read }: { label?: string; read?: string } = {},
): ArrayField<InputValue[]> => {
  const inputs =
    read && Object.hasOwn(kit.reads, read)
      ? describeFields(kit.reads[read].input, "input")
      : [];
  const choices = inputs.map(
    (input) =>
      input.options?.map(String) ??
      (input.type === "boolean" ? ["true", "false"] : undefined),
  );
  // Every item shares one value field, so a list of values would leave no way
  // to type a free-text input's value
  const values = choices.every(Boolean)
    ? [...new Set(choices.flatMap((values) => values ?? []))]
    : [];

  return {
    type: "array",
    label,
    arrayFields: {
      name: inputs.length
        ? {
            type: "select",
            options: inputs.map((input) => ({
              label: input.label,
              value: input.name,
            })),
          }
        : { type: "text" },
      value: values.length
        ? {
            type: "select",
            options: values.map((value) => ({ label: value, value })),
          }
        : { type: "text" },
    },
    defaultItemProps: { name: inputs[0]?.name ?? "", value: "" },
    getItemSummary: (item) =>
      item.name ? `${item.name}: ${item.value}` : "Filter",
    ai: {
      instructions:
        "Fixed input for the chosen read API, such as filters. Only add what the app needs, using the input names and values that API lists. Leave empty to read everything.",
    },
  };
};

/**
 * Read a string as the value an input's schema takes.
 *
 * @param schema The input's schema.
 * @param value The value, as `inputField` stores it.
 * @returns The value, as a boolean or number when the schema needs one.
 */
const parseInputValue = (schema: z.ZodType, value: string) => {
  if (schema.safeParse(value).success) return { ok: true, value };

  try {
    const parsed: unknown = JSON.parse(value);

    if (schema.safeParse(parsed).success) return { ok: true, value: parsed };
  } catch {}

  return { ok: false, value };
};

/**
 * Turn an `inputField`'s value into input for the chosen read.
 *
 * @param kit The kit.
 * @param read The chosen read.
 * @param values The `inputField`'s value.
 * @returns The input to pass to `useRead`, and the names of inputs the read
 *   doesn't take or whose values it refuses.
 */
export const pickReadInput = (
  kit: VibeKit,
  read: string | undefined,
  values: unknown,
) => {
  const input: Record<string, unknown> = {};
  const invalid: string[] = [];

  if (!read || !Object.hasOwn(kit.reads, read) || !Array.isArray(values)) {
    return { input, invalid };
  }

  const shape: Record<string, z.ZodType> = kit.reads[read].input?.shape ?? {};

  for (const item of values as Partial<InputValue>[]) {
    const { name, value } = item ?? {};

    if (!name || value === undefined || value === "") continue;

    const schema = Object.hasOwn(shape, name) ? shape[name] : undefined;
    const parsed = schema && parseInputValue(schema, String(value));

    if (parsed?.ok) {
      input[name] = parsed.value;
    } else {
      invalid.push(name);
    }
  }

  return { input, invalid };
};
