import { describe, expect, it, vi } from "vitest";

vi.mock("@puckeditor/cloud-client", () => ({
  tool: (definition: unknown) => definition,
}));

import { z } from "zod/v4";
import { getAiOptions } from "../get-ai-options";
import { defineVibeKit } from "../../define-vibe-kit";
import { kit } from "../../__tests__/helpers";

const callRead = vi.fn();

describe("getAiOptions", () => {
  it("forces design mode, with scripts, for every request", () => {
    const options = getAiOptions(kit, { description: "", callRead });

    expect(options.mode).toBe("design");
    expect(options.designMode?.scripts).toBe(true);
  });

  it("puts the design rules before how scripts call the APIs", () => {
    const designed = defineVibeKit({
      ...kit,
      ai: { designRules: "Be bold." },
    });
    const { designMode } = getAiOptions(designed, {
      description: "",
      callRead,
    });

    expect(designMode?.instructions).toMatch(
      /^Be bold\.\n\n## Data in scripts/,
    );
    expect(designMode?.instructions).toContain(
      'await vibeKit.read("listTickets", {})',
    );
  });

  it("adds the kit's APIs to the context", () => {
    expect(
      getAiOptions(kit, { description: "## Data APIs", callRead }).context,
    ).toBe("We are Acme.\n\n## Data APIs");
  });

  it("passes the model through, without the kit-only rules", () => {
    const options = getAiOptions(
      defineVibeKit({
        ...kit,
        ai: { model: "openai/gpt-4.1", designRules: "Be bold." },
      }),
      { description: "", callRead },
    );

    expect(options.model).toBe("openai/gpt-4.1");
    expect(options).not.toHaveProperty("designRules");
    expect(options).not.toHaveProperty("tools");
  });

  it("lets the AI leave out optional inputs of a read tool with null", () => {
    const reading = defineVibeKit({ ...kit, ai: { readData: true } });
    const { tools } = getAiOptions(reading, { description: "", callRead });
    const inputSchema = (tools?.listTickets as { inputSchema: z.ZodType })
      .inputSchema;

    const json = z.toJSONSchema(inputSchema);

    expect(json).toMatchObject({
      properties: {
        status: { enum: ["open", "closed", null] },
        assignee: { type: ["string", "null"] },
      },
    });
    // Puck Cloud can't take `anyOf` in a tool's input
    expect(JSON.stringify(json)).not.toContain("anyOf");
    expect(
      inputSchema.safeParse({ status: null, assignee: null }).success,
    ).toBe(true);
  });

  it("tells the AI not to copy data the read tools return", () => {
    const reading = defineVibeKit({ ...kit, ai: { readData: true } });

    expect(
      getAiOptions(reading, { description: "", callRead }).designMode
        ?.instructions,
    ).toContain("never copy data into markup or scripts");
  });
});
