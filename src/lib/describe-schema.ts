import { z } from "zod/v4";
import type { ReadApi } from "../types";

/** A field of an API's input or output, read from its zod schema. */
export type FieldDescriptor = {
  /** The property's key. */
  name: string;
  /** The schema's `title` meta, or the key in sentence case. */
  label: string;
  /** The schema's description. */
  description?: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "unknown";
  /** The format, such as "email", "date-time" or a custom `meta({ format })`. */
  format?: string;
  /** The values an enum allows. */
  options?: (string | number | boolean)[];
  required: boolean;
};

/** What a read returns: rows, one record, or a single value. */
export type ReadShape = "list" | "record" | "value";

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number | boolean)[];
  const?: string | number | boolean;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  title?: string;
  description?: string;
  format?: string;
};

const types = ["string", "number", "boolean", "array", "object"] as const;

/**
 * Convert a zod schema to JSON Schema.
 *
 * @param schema The zod schema.
 * @param io Whether to describe what the schema accepts or what it returns.
 * @returns The JSON Schema.
 */
const toJsonSchema = (schema: z.ZodType, io: "input" | "output") =>
  z.toJSONSchema(schema, { io, unrepresentable: "any" }) as JsonSchema;

/**
 * Drop `null` from a nullable schema, keeping the outer title and description.
 *
 * @param schema The JSON Schema.
 * @returns The schema without its `null` branch.
 */
const unwrapNullable = (schema: JsonSchema): JsonSchema => {
  const branches = (schema.anyOf ?? schema.oneOf)?.filter(
    (branch) => branch.type !== "null",
  );

  if (branches?.length === 1) {
    return {
      ...unwrapNullable(branches[0]),
      title: schema.title ?? branches[0].title,
      description: schema.description ?? branches[0].description,
    };
  }

  if (Array.isArray(schema.type)) {
    return { ...schema, type: schema.type.find((type) => type !== "null") };
  }

  return schema;
};

/**
 * Turn a property key into a label, such as "customerEmail" to "Customer email".
 *
 * @param name The key.
 * @returns The label.
 */
export const humanize = (name: string) => {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * Describe one property of an object schema.
 *
 * @param name The property's key.
 * @param property The property's JSON Schema.
 * @param required Whether the object requires the property.
 * @returns The field.
 */
const describeProperty = (
  name: string,
  property: JsonSchema,
  required: boolean,
): FieldDescriptor => {
  const schema = unwrapNullable(property);
  const options =
    schema.enum ?? (schema.const !== undefined ? [schema.const] : undefined);
  const jsonType =
    schema.type === "integer"
      ? "number"
      : typeof schema.type === "string"
        ? schema.type
        : typeof options?.[0];

  return {
    name,
    label: schema.title ?? humanize(name),
    description: schema.description,
    type: types.find((type) => type === jsonType) ?? "unknown",
    format: schema.format,
    options,
    required,
  };
};

/**
 * Describe the fields of an object schema, or of each item in an array schema.
 *
 * @param schema The zod schema.
 * @param io Whether to describe what the schema accepts, for inputs, or what
 *   it returns, for outputs. Defaults to "output".
 * @returns The fields, in the schema's order. Empty for other schemas.
 */
export const describeFields = (
  schema: z.ZodType | undefined,
  io: "input" | "output" = "output",
): FieldDescriptor[] => {
  if (!schema) return [];

  let json = unwrapNullable(toJsonSchema(schema, io));

  if (json.type === "array" && json.items) json = unwrapNullable(json.items);

  const required = new Set(json.required ?? []);

  return Object.entries(json.properties ?? {}).map(([name, property]) =>
    describeProperty(name, property, required.has(name)),
  );
};

/**
 * Find what a read returns.
 *
 * @param api The read API.
 * @returns "list" for arrays, "record" for objects, otherwise "value".
 */
export const getReadShape = (api: ReadApi): ReadShape => {
  const { type } = unwrapNullable(toJsonSchema(api.output, "output"));

  if (type === "array") return "list";
  if (type === "object") return "record";

  return "value";
};

/**
 * Summarize a field's type for a prompt, such as `"open" | "closed"`.
 *
 * @param field The field.
 * @returns The summary.
 */
export const describeFieldType = (field: FieldDescriptor) =>
  field.options
    ? field.options.map((option) => JSON.stringify(option)).join(" | ")
    : [field.type, field.format].filter(Boolean).join(", ");
