import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { describeFields, getReadShape, humanize } from "../lib/describe-schema";
import { kit, ticket } from "./helpers";

describe("describeFields", () => {
  it("describes an object's fields in order", () => {
    expect(describeFields(ticket)).toEqual([
      {
        name: "id",
        label: "Id",
        description: undefined,
        type: "string",
        format: undefined,
        options: undefined,
        required: true,
      },
      {
        name: "subject",
        label: "Subject",
        description: undefined,
        type: "string",
        format: undefined,
        options: undefined,
        required: true,
      },
      {
        name: "status",
        label: "Status",
        description: undefined,
        type: "string",
        format: undefined,
        options: ["open", "closed"],
        required: true,
      },
      {
        name: "total",
        label: "Order total",
        description: undefined,
        type: "number",
        format: "currency",
        options: undefined,
        required: true,
      },
    ]);
  });

  it("describes each item of an array", () => {
    expect(describeFields(z.array(ticket)).map(({ name }) => name)).toEqual([
      "id",
      "subject",
      "status",
      "total",
    ]);
  });

  it("unwraps nullable fields and reads descriptions", () => {
    const [field] = describeFields(
      z.object({ note: z.string().nullable().describe("A note") }),
    );

    expect(field).toMatchObject({
      type: "string",
      description: "A note",
      required: true,
    });
  });

  it("marks optional and defaulted inputs as not required", () => {
    const fields = describeFields(
      z.object({
        a: z.string().optional(),
        b: z.number().int().default(3),
        c: z.email(),
      }),
      "input",
    );

    expect(
      fields.map(({ name, type, format, required }) => ({
        name,
        type,
        format,
        required,
      })),
    ).toEqual([
      { name: "a", type: "string", format: undefined, required: false },
      { name: "b", type: "number", format: undefined, required: false },
      { name: "c", type: "string", format: "email", required: true },
    ]);
  });

  it("returns nothing without a schema or for non-objects", () => {
    expect(describeFields(undefined)).toEqual([]);
    expect(describeFields(z.number())).toEqual([]);
  });
});

describe("getReadShape", () => {
  it("tells lists, records and values apart", () => {
    expect(getReadShape(kit.reads.listTickets)).toBe("list");
    expect(getReadShape(kit.reads.getMetrics)).toBe("record");
    expect(getReadShape({ description: "", output: z.number() })).toBe("value");
  });
});

describe("humanize", () => {
  it("turns keys into sentence case", () => {
    expect(humanize("customerEmail")).toBe("Customer email");
    expect(humanize("created_at")).toBe("Created at");
    expect(humanize("mrr")).toBe("Mrr");
  });
});
