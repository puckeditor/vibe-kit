import { describe, expect, it } from "vitest";
import { defineVibeKit } from "../define-vibe-kit";
import { describeKit } from "../lib/describe-kit";
import { kit } from "./helpers";

describe("describeKit", () => {
  it("lists every API with its input and output", () => {
    expect(describeKit(kit)).toBe(
      [
        "## Data APIs",
        "Apps read and change data only through these APIs. Bind components to them by name. Never invent APIs, fields or data.",
        "### Read APIs",
        [
          "- `listTickets` (List tickets): Support tickets.",
          '  - Input: status ("open" | "closed"), assignee (string)',
          '  - Returns: A list of rows with: id (string), subject (string), status ("open" | "closed"), total (number, currency)',
          "- `getMetrics` (Metrics): Headline numbers.",
          "  - Returns: One record with: openTickets (number), team (string)",
        ].join("\n"),
        "### Write APIs",
        [
          "- `closeTicket` (Close ticket): Close a ticket.",
          "  - Input: id (string, required)",
          "  - Asks the user to confirm first.",
        ].join("\n"),
      ].join("\n\n"),
    );
  });

  it("mentions vibeKit when the rules allow scripts", () => {
    const scripted = defineVibeKit({
      ...kit,
      ai: { designMode: { allowed: true, scripts: true } },
    });

    expect(describeKit(scripted)).toContain(
      "or call them from designed components' scripts with `vibeKit`",
    );
  });

  it("says when apps can't change data", () => {
    expect(describeKit(defineVibeKit({}))).toContain(
      "None. Apps can't change data.",
    );
  });
});
