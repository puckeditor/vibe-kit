import type { Config, Data } from "@puckeditor/core";
import { withDynamicConfig } from "@puckeditor/plugin-ai";
import type { VibeKit } from "../types";

type DesignedComponent = { script?: unknown } & Record<string, unknown>;

type DynamicConfig = {
  script?: unknown;
  components?: Record<string, DesignedComponent>;
} & Record<string, unknown>;

/**
 * Remove the scripts from a page's designed components and globals.
 *
 * @param data The page.
 * @returns A copy without scripts, or the page when it has none to remove.
 */
const withoutScripts = (data: Data): Data => {
  const props: Record<string, unknown> = data.root?.props ?? {};
  const dynamicConfig = props._dynamicConfig as DynamicConfig | undefined;

  if (typeof dynamicConfig !== "object" || dynamicConfig === null) return data;

  const { script: _script, components = {}, ...globals } = dynamicConfig;
  const root = {
    ...data.root,
    props: {
      ...props,
      _dynamicConfig: {
        ...globals,
        components: Object.fromEntries(
          Object.entries(components).map(
            ([name, { script: _componentScript, ...component }]) => [
              name,
              component,
            ],
          ),
        ),
      },
    },
  };

  return { ...data, root: root as Data["root"] };
};

/**
 * Prepare a page's config and data to render under the kit's AI rules.
 *
 * Adds the components the AI designed when the rules allow design mode, and
 * removes their scripts unless the rules allow scripts. Without design mode,
 * designed components don't render.
 *
 * @param kit The kit.
 * @param config Your Puck config.
 * @param data The page.
 * @returns The config and data to pass to `<Render>`.
 */
export const applyRules = <UserConfig extends Config>(
  kit: VibeKit,
  config: UserConfig,
  data: Data,
): { config: UserConfig; data: Data } => {
  const { designMode } = kit.ai;

  if (!designMode?.allowed) return { config, data };

  const allowed = designMode.scripts ? data : withoutScripts(data);

  return { config: withDynamicConfig(config, allowed), data: allowed };
};
