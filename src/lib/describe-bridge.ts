import type { VibeKit } from "../types";

/**
 * Describe `window.vibeKit` for the AI's design-mode instructions.
 *
 * @param kit The kit, for an example read.
 * @returns A Markdown section on calling the kit's APIs from scripts.
 */
export const describeBridge = (kit: VibeKit) => {
  const [example = "readName"] = Object.keys(kit.reads);

  return [
    "## Data in scripts",
    "Scripts read and change data with the global `vibeKit`, calling the Data APIs by name. Never call `/api/puck` with `fetch`: the server refuses it.",
    [
      "- `await vibeKit.read(name, input)` returns what the read API returns. Pass its input as an object, or `{}`.",
      "- `await vibeKit.write(name, input)` calls the write API and returns `{ data, dryRun }`. In the editor, writes are test runs: they check the input but change nothing, and return `{ data: null, dryRun: true }`.",
      "- `vibeKit.onChange(callback)` calls `callback` after every write that changes data, and returns a function that stops it. Read again in the callback so the component stays current.",
      "- Both throw on failure, with the reason in `error.message` and invalid inputs in `error.issues`. Show the reason to the user.",
    ].join("\n"),
    ...(kit.ai.readData
      ? [
          "You can call the read APIs as tools to see real data while you design. Use it to shape the design, but never copy data into markup or scripts: read it with `vibeKit` when the app runs, so it stays current.",
        ]
      : []),
    "Every component that shows or changes data needs a script. Load data when the component connects, show a loading state until it arrives, and show the reason when a call fails.",
    [
      "```js",
      "class ExampleData extends HTMLElement {",
      "  async connectedCallback() {",
      "    const render = async () => {",
      `      const data = await vibeKit.read("${example}", {});`,
      "      this.textContent = JSON.stringify(data);",
      "    };",
      "",
      "    this.stop = vibeKit.onChange(render);",
      "    await render();",
      "  }",
      "",
      "  disconnectedCallback() {",
      "    this.stop?.();",
      "  }",
      "}",
      "",
      "if (!customElements.get('example-data')) {",
      "  customElements.define('example-data', ExampleData);",
      "}",
      "```",
    ].join("\n"),
  ].join("\n\n");
};
