import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { createAppConfig } from "../app-config";

/**
 * Render a config's root, as Puck would.
 *
 * @param config The config.
 * @param title The app's name.
 * @returns The HTML.
 */
const renderRoot = (
  config: ReturnType<typeof createAppConfig>,
  title: string,
) => {
  const Root = config.root!.render as unknown as (props: {
    title: string;
    children: ReactNode;
  }) => ReactNode;

  return renderToStaticMarkup(<Root title={title}>App</Root>);
};

describe("createAppConfig", () => {
  it("has no components, so the AI designs them all", () => {
    expect(createAppConfig().components).toEqual({});
  });

  it("puts every app in the frame, with its name", () => {
    const config = createAppConfig(({ title, children }) => (
      <main>
        <h1>{title}</h1>
        {children}
      </main>
    ));

    expect(renderRoot(config, "Orders")).toBe(
      "<main><h1>Orders</h1>App</main>",
    );
    expect(renderRoot(config, "")).toBe(
      "<main><h1>Untitled app</h1>App</main>",
    );
  });

  it("shows the app on its own without a frame", () => {
    expect(renderRoot(createAppConfig(), "Orders")).toBe("App");
  });
});
