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
  it("tells design mode how scripts call the APIs when the rules allow scripts", () => {
    const scripted = defineVibeKit({
      ...kit,
      ai: {
        designMode: { allowed: true, scripts: true, instructions: "Be bold." },
      },
    });
    const { designMode } = getAiOptions(scripted, {
      description: "",
      callRead,
    });

    expect(designMode?.allowed).toBe(true);
    expect(designMode?.scripts).toBe(true);
    expect(designMode?.instructions).toMatch(
      /^Be bold\.\n\n## Data in scripts/,
    );
    expect(designMode?.instructions).toContain(
      'await vibeKit.read("listTickets", {})',
    );
  });

  it("leaves design mode alone without scripts", () => {
    const designed = defineVibeKit({
      ...kit,
      ai: { designMode: { allowed: true, instructions: "Be bold." } },
    });

    expect(
      getAiOptions(designed, { description: "", callRead }).designMode,
    ).toEqual({ allowed: true, instructions: "Be bold." });
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

  it("tells design mode not to copy data the read tools return", () => {
    const reading = defineVibeKit({
      ...kit,
      ai: { readData: true, designMode: { allowed: true, scripts: true } },
    });

    expect(
      getAiOptions(reading, { description: "", callRead }).designMode
        ?.instructions,
    ).toContain("never copy data into markup or scripts");
  });

  it("leaves out design mode when the rules don't set it", () => {
    expect(getAiOptions(kit, { description: "", callRead })).not.toHaveProperty(
      "designMode",
    );
  });
});
