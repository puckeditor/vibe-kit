import { describe, expect, it, vi } from "vitest";
import type { Config, Data } from "@puckeditor/core";

vi.mock("@puckeditor/plugin-ai", () => ({
  withDynamicConfig: (config: Config, data: Data) => ({
    ...config,
    designedFrom: data,
  }),
}));

import { applyRules } from "../apply-rules";
import { defineVibeKit } from "../../define-vibe-kit";

const config: Config = { components: {} };

const data = {
  root: {
    props: {
      title: "App",
      _dynamicConfig: {
        styles: ":root{}",
        script: "alert(1)",
        components: {
          Hero: { html: "<div></div>", fields: {}, script: "alert(2)" },
        },
      },
    },
  },
  content: [],
} as unknown as Data;

describe("applyRules", () => {
  it("leaves designed components out without design mode", () => {
    expect(applyRules(defineVibeKit({}), config, data)).toEqual({
      config,
      data,
    });
  });

  it("removes scripts unless the rules allow them", () => {
    const kit = defineVibeKit({ ai: { designMode: { allowed: true } } });
    const result = applyRules(kit, config, data);

    expect(result.data.root.props).toEqual({
      title: "App",
      _dynamicConfig: {
        styles: ":root{}",
        components: { Hero: { html: "<div></div>", fields: {} } },
      },
    });
    expect(result.config).toEqual({ ...config, designedFrom: result.data });
  });

  it("keeps scripts when the rules allow them", () => {
    const kit = defineVibeKit({
      ai: { designMode: { allowed: true, scripts: true } },
    });

    expect(applyRules(kit, config, data).data).toBe(data);
  });
});
