import type { VibeKit, ReadApi, WriteApi } from "../types";
import { allowsScripts } from "./describe-bridge";
import {
  describeFields,
  describeFieldType,
  getReadShape,
  humanize,
  type FieldDescriptor,
} from "./describe-schema";

/**
 * List fields for a prompt, such as `id (string), status ("open" | "closed")`.
 *
 * @param fields The fields.
 * @param markRequired Whether to mark required fields.
 * @returns The list.
 */
export const listFields = (fields: FieldDescriptor[], markRequired = false) =>
  fields
    .map(
      (field) =>
        `${field.name} (${describeFieldType(field)}${
          markRequired && field.required ? ", required" : ""
        })`,
    )
    .join(", ");

/**
 * Describe what a read returns, such as "A list of rows with: id (string)".
 *
 * @param api The read API.
 * @returns The description.
 */
export const describeReadOutput = (api: ReadApi) => {
  const fields = listFields(describeFields(api.output));

  switch (getReadShape(api)) {
    case "list":
      return `A list of rows with: ${fields}`;
    case "record":
      return `One record with: ${fields}`;
    default:
      return "A single value";
  }
};

/**
 * Describe one read API as a Markdown list item.
 *
 * @param name The API's key.
 * @param api The read API.
 * @returns The item.
 */
const describeRead = (name: string, api: ReadApi) => {
  const input = describeFields(api.input, "input");

  return [
    `- \`${name}\` (${api.label ?? humanize(name)}): ${api.description}`,
    input.length ? `  - Input: ${listFields(input)}` : null,
    `  - Returns: ${describeReadOutput(api)}`,
  ]
    .filter(Boolean)
    .join("\n");
};

/**
 * Describe one write API as a Markdown list item.
 *
 * @param name The API's key.
 * @param api The write API.
 * @returns The item.
 */
const describeWrite = (name: string, api: WriteApi) =>
  [
    `- \`${name}\` (${api.label ?? humanize(name)}): ${api.description}`,
    `  - Input: ${listFields(describeFields(api.input, "input"), true)}`,
    api.confirm ? "  - Asks the user to confirm first." : null,
  ]
    .filter(Boolean)
    .join("\n");

/**
 * Describe a kit's APIs for the AI's context.
 *
 * @param kit The kit.
 * @returns A Markdown section listing every read and write API with its fields.
 */
export const describeKit = (kit: VibeKit) => {
  const reads = Object.entries(kit.reads);
  const writes = Object.entries(kit.writes);

  return [
    "## Data APIs",
    allowsScripts(kit)
      ? "Apps read and change data only through these APIs: bind components to them by name, or call them from designed components' scripts with `vibeKit`. Never invent APIs, fields or data."
      : "Apps read and change data only through these APIs. Bind components to them by name. Never invent APIs, fields or data.",
    "### Read APIs",
    reads.length
      ? reads.map(([name, api]) => describeRead(name, api)).join("\n")
      : "None.",
    "### Write APIs",
    writes.length
      ? writes.map(([name, api]) => describeWrite(name, api)).join("\n")
      : "None. Apps can't change data.",
  ].join("\n\n");
};
