import type { ComponentType, ReactNode } from "react";
import type { Config } from "@puckeditor/core";

/**
 * Your layout around every app, such as a header and your theme. It gets the
 * app's name, and the components the AI designed as `children`.
 *
 * Set the CSS variables your design rules name here, so every app has them.
 */
export type AppFrame = ComponentType<{ title: string; children: ReactNode }>;

/**
 * Show an app without a layout around it.
 *
 * @param props.children The app's components.
 * @returns The app.
 */
const NoFrame: AppFrame = ({ children }) => <>{children}</>;

/** The Puck config apps render with: a root with the app's name, and no components. */
export type AppConfig = Config<{ components: {}; root: { title: string } }>;

/**
 * Make the Puck config apps render with: a root that holds the app's name and
 * your frame, and no components, as the AI designs them all.
 *
 * @param frame Your layout around every app. Defaults to none.
 * @returns The config.
 */
export const createAppConfig = (frame: AppFrame = NoFrame): AppConfig => {
  const Frame = frame;

  return {
    root: {
      fields: { title: { type: "text", label: "App name" } },
      defaultProps: { title: "Untitled app" },
      render: ({ title, children }) => (
        <Frame title={title || "Untitled app"}>{children}</Frame>
      ),
    },
    components: {},
  };
};
