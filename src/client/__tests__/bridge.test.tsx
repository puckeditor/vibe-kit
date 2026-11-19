// @vitest-environment jsdom
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VibeKitProvider } from "../provider";
import { createVibeKitPlugin } from "../create-vibe-kit-plugin";
import { VIBE_KIT_HEADER } from "../../lib/constants";
import { kit } from "../../__tests__/helpers";

const fetchMock = vi.fn();

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

/**
 * Render a provider, so `window.vibeKit` is installed.
 *
 * @param dryRun Whether writes only check their input.
 * @returns The bridge.
 */
const mountBridge = (dryRun = false) => {
  render(
    <VibeKitProvider kit={kit} dryRun={dryRun}>
      {null}
    </VibeKitProvider>,
  );

  return window.vibeKit!;
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("confirm", () => true);
  fetchMock.mockImplementation(() => json({ data: [{ id: "t1" }] }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("window.vibeKit", () => {
  it("is installed while the provider shows", () => {
    const { unmount } = render(
      <VibeKitProvider kit={kit}>{null}</VibeKitProvider>,
    );

    expect(window.vibeKit).toBeDefined();

    unmount();

    expect(window.vibeKit).toBeUndefined();
  });

  it("reads with the kit's header, once per input until data changes", async () => {
    const vibeKit = mountBridge();

    await expect(
      vibeKit.read("listTickets", { status: "open" }),
    ).resolves.toEqual([{ id: "t1" }]);
    await vibeKit.read("listTickets", { status: "open" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      [VIBE_KIT_HEADER]: "1",
    });
  });

  it("throws the server's error", async () => {
    fetchMock.mockImplementation(() =>
      json({ error: "Invalid input", issues: [{ path: ["status"] }] }, 400),
    );

    await expect(mountBridge().read("listTickets")).rejects.toMatchObject({
      message: "Invalid input",
      issues: [{ path: ["status"] }],
    });
  });

  it("throws for APIs the kit doesn't have, without fetching", async () => {
    await expect(mountBridge().read("nope")).rejects.toThrow(
      `There's no read API called "nope".`,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only checks writes in the editor", async () => {
    fetchMock.mockImplementation(() => json({ data: null, dryRun: true }));

    const vibeKit = mountBridge(true);
    const onChange = vi.fn();

    vibeKit.onChange(onChange);

    await expect(vibeKit.write("closeTicket", { id: "t1" })).resolves.toEqual({
      data: null,
      dryRun: true,
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      input: { id: "t1" },
      dryRun: true,
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("tells listeners about writes, and reads again after them", async () => {
    const vibeKit = mountBridge();
    const onChange = vi.fn();
    const stop = vibeKit.onChange(onChange);

    await vibeKit.read("listTickets");

    fetchMock.mockImplementationOnce(() => json({ data: { id: "t1" } }));

    await expect(vibeKit.write("closeTicket", { id: "t1" })).resolves.toEqual({
      data: { id: "t1" },
      dryRun: false,
    });
    expect(onChange).toHaveBeenCalledTimes(1);

    await vibeKit.read("listTickets");

    expect(fetchMock).toHaveBeenCalledTimes(3);

    stop();
    await vibeKit.write("closeTicket", { id: "t1" });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("throws for invalid input, without sending it", async () => {
    await expect(mountBridge().write("closeTicket", {})).rejects.toMatchObject({
      issues: [{ path: ["id"] }],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when the user declines to confirm", async () => {
    vi.stubGlobal("confirm", () => false);

    await expect(
      mountBridge().write("closeTicket", { id: "t1" }),
    ).rejects.toMatchObject({ cancelled: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createVibeKitPlugin", () => {
  it("gives the editor preview's window the provider's bridge", () => {
    const frame = document.createElement("iframe");

    document.body.append(frame);

    const preview = frame.contentWindow!;
    const Iframe = createVibeKitPlugin().overrides.iframe;
    const { unmount } = render(
      <VibeKitProvider kit={kit}>
        {
          Iframe({
            document: frame.contentDocument!,
            children: null,
          }) as ReactElement
        }
      </VibeKitProvider>,
    );

    expect(preview.vibeKit).toBe(window.vibeKit);

    unmount();

    expect(preview.vibeKit).toBeUndefined();
    frame.remove();
  });
});
