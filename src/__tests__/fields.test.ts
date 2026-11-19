import { describe, expect, it } from "vitest";
import {
  inputField,
  keyField,
  pickReadInput,
  readField,
  writeField,
} from "../fields";
import { z } from "zod/v4";
import { defineVibeKit } from "../define-vibe-kit";
import { kit } from "./helpers";

describe("readField", () => {
  it("offers every read", () => {
    expect(readField(kit).options).toEqual([
      { label: "List tickets", value: "listTickets" },
      { label: "Metrics", value: "getMetrics" },
    ]);
  });

  it("only offers reads of the shape", () => {
    expect(readField(kit, { shape: "record" }).options).toEqual([
      { label: "Metrics", value: "getMetrics" },
    ]);
  });
});

describe("writeField", () => {
  it("offers every write, with none last", () => {
    expect(writeField(kit, { optional: true }).options).toEqual([
      { label: "Close ticket", value: "closeTicket" },
      { label: "None", value: "" },
    ]);
  });
});

describe("keyField", () => {
  it("offers every field of the shape's reads", () => {
    expect(
      keyField(kit, { shape: "list" }).options.map(({ value }) => value),
    ).toEqual(["id", "subject", "status", "total"]);
  });

  it("narrows to the chosen read and type", () => {
    expect(
      keyField(kit, { read: "getMetrics", type: "number" }).options,
    ).toEqual([{ label: "Open tickets", value: "openTickets" }]);
  });

  it("labels a field by its name when reads label it differently", () => {
    const shared = defineVibeKit({
      reads: {
        orders: {
          description: "",
          output: z.array(
            z.object({ createdAt: z.string().meta({ title: "Placed" }) }),
          ),
        },
        tickets: {
          description: "",
          output: z.array(
            z.object({ createdAt: z.string().meta({ title: "Opened" }) }),
          ),
        },
      },
    });

    expect(keyField(shared).options).toEqual([
      { label: "Created at", value: "createdAt" },
    ]);
    expect(keyField(shared, { read: "tickets" }).options).toEqual([
      { label: "Opened", value: "createdAt" },
    ]);
  });

  it("offers every read when the chosen one is unknown", () => {
    expect(keyField(kit, { read: "nope" }).options).toHaveLength(6);
  });
});

describe("inputField", () => {
  it("takes text without a chosen read, for the AI", () => {
    const field = inputField(kit);

    expect(field.arrayFields).toEqual({
      name: { type: "text" },
      value: { type: "text" },
    });
    expect(field.defaultItemProps).toEqual({ name: "", value: "" });
  });

  it("offers the chosen read's inputs, with free text when one takes text", () => {
    expect(inputField(kit, { read: "listTickets" }).arrayFields).toEqual({
      name: {
        type: "select",
        options: [
          { label: "Status", value: "status" },
          { label: "Assignee", value: "assignee" },
        ],
      },
      value: { type: "text" },
    });
  });

  it("offers values when every input is an enum or boolean", () => {
    const enums = defineVibeKit({
      reads: {
        list: {
          description: "",
          input: z.object({
            status: z.enum(["open", "closed"]).optional(),
            urgent: z.boolean().optional(),
          }),
          output: z.array(z.object({})),
        },
      },
    });

    expect(inputField(enums, { read: "list" }).arrayFields.value).toEqual({
      type: "select",
      options: [
        { label: "open", value: "open" },
        { label: "closed", value: "closed" },
        { label: "true", value: "true" },
        { label: "false", value: "false" },
      ],
    });
  });
});

describe("pickReadInput", () => {
  it("keeps the values the read accepts", () => {
    expect(
      pickReadInput(kit, "listTickets", [
        { name: "status", value: "open" },
        { name: "assignee", value: "" },
      ]),
    ).toEqual({ input: { status: "open" }, invalid: [] });
  });

  it("reports inputs the read doesn't take or values it refuses", () => {
    expect(
      pickReadInput(kit, "listTickets", [
        { name: "status", value: "paid" },
        { name: "plan", value: "growth" },
      ]),
    ).toEqual({ input: {}, invalid: ["status", "plan"] });
  });

  it("parses values the schema needs as numbers or booleans", () => {
    const typed = defineVibeKit({
      reads: {
        list: {
          description: "",
          input: z.object({ limit: z.number(), urgent: z.boolean() }),
          output: z.array(z.object({})),
        },
      },
    });

    expect(
      pickReadInput(typed, "list", [
        { name: "limit", value: "5" },
        { name: "urgent", value: "true" },
      ]),
    ).toEqual({ input: { limit: 5, urgent: true }, invalid: [] });
  });

  it("keeps nothing for an unknown read or a value that isn't a list", () => {
    const filters = [{ name: "status", value: "open" }];

    expect(pickReadInput(kit, "constructor", filters).input).toEqual({});
    expect(pickReadInput(kit, "listTickets", { status: "open" }).input).toEqual(
      {},
    );
  });
});
