// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VibeKitProvider } from "../provider";
import { useRead } from "../use-read";
import { useWrite } from "../use-write";
import { kit } from "../../__tests__/helpers";

const fetchMock = vi.fn();

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const wrapper = (dryRun = false) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <VibeKitProvider kit={kit} dryRun={dryRun}>
        {children}
      </VibeKitProvider>
    );
  };

const bodyOf = (call: unknown[]) =>
  JSON.parse((call[1] as RequestInit).body as string);

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(() => json({ data: [{ id: "t1" }] }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("useRead", () => {
  it("reads once for the same name and input", async () => {
    const { result } = renderHook(
      () => [
        useRead("listTickets", { status: "open", assignee: "" }),
        useRead("listTickets", { status: "open" }),
      ],
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current[0].isLoading).toBe(false));

    expect(result.current[1].data).toEqual([{ id: "t1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/puck/reads/listTickets");
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      input: { status: "open" },
    });
  });

  it("reports reads the kit doesn't have, without fetching", () => {
    const { result } = renderHook(() => useRead("nope"), {
      wrapper: wrapper(),
    });

    expect(result.current.error).toBe(`There's no read API called "nope".`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports the API's error", async () => {
    fetchMock.mockImplementation(() => json({ error: "Nope" }, 403));

    const { result } = renderHook(() => useRead("getMetrics"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.error).toBe("Nope"));
  });
});

describe("useWrite", () => {
  it("reads again after a write", async () => {
    vi.stubGlobal("confirm", () => true);

    const { result } = renderHook(
      () => ({
        read: useRead("listTickets"),
        write: useWrite("closeTicket"),
      }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.read.isLoading).toBe(false));

    fetchMock.mockImplementationOnce(() => json({ data: { id: "t1" } }));

    await act(() => result.current.write.call({ id: "t1" }));

    expect(result.current.write.outcome).toEqual({
      ok: true,
      data: { id: "t1" },
      dryRun: false,
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toBe("/api/puck/reads/listTickets");
  });

  it("checks the input before sending it", async () => {
    const { result } = renderHook(() => useWrite("closeTicket"), {
      wrapper: wrapper(),
    });

    const outcome = await act(() => result.current.call({}));

    expect(outcome).toMatchObject({ ok: false, issues: [{ path: ["id"] }] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the user to confirm", async () => {
    vi.stubGlobal("confirm", () => false);

    const { result } = renderHook(() => useWrite("closeTicket"), {
      wrapper: wrapper(),
    });

    const outcome = await act(() => result.current.call({ id: "t1" }));

    expect(outcome).toMatchObject({ ok: false, cancelled: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends dry runs from the editor, without reading again", async () => {
    vi.stubGlobal("confirm", () => true);
    fetchMock.mockImplementation(() => json({ data: null, dryRun: true }));

    const { result } = renderHook(() => useWrite("closeTicket"), {
      wrapper: wrapper(true),
    });

    const outcome = await act(() => result.current.call({ id: "t1" }));

    expect(outcome).toEqual({ ok: true, data: null, dryRun: true });
    expect(bodyOf(fetchMock.mock.calls[0])).toEqual({
      input: { id: "t1" },
      dryRun: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
