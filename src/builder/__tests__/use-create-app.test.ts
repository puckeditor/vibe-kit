// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toAppPath, useCreateApp } from "../use-create-app";

const fetchMock = vi.fn();

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockImplementation(() => json({ id: "page_1" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("toAppPath", () => {
  it("turns a name into a path", () => {
    expect(toAppPath("  Loan Pipeline (Q4)! ")).toBe("/loan-pipeline-q4");
  });

  it("returns the root for a name without letters or digits", () => {
    expect(toAppPath("—")).toBe("/");
  });
});

describe("useCreateApp", () => {
  it("creates a page titled with the app's name", async () => {
    const { result } = renderHook(() => useCreateApp());
    let path: string | undefined;

    await act(async () => {
      path = await result.current.create({
        name: " Fraud queue ",
        prompt: "A queue",
      });
    });

    expect(path).toBe("/fraud-queue");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/puck/pages",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      path: "/fraud-queue",
      data: { root: { props: { title: "Fraud queue" } }, content: [] },
    });
    expect(result.current.isCreating).toBe(true);
  });

  it("asks for a name and a prompt before creating", async () => {
    const { result } = renderHook(() => useCreateApp());

    await act(async () => {
      await result.current.create({ name: "", prompt: "A queue" });
    });
    expect(result.current.error).toBe("Give your app a name.");

    await act(async () => {
      await result.current.create({ name: "Queue", prompt: " " });
    });
    expect(result.current.error).toBe("Describe what your app should do.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("explains when an app already has the path", async () => {
    fetchMock.mockImplementation(() =>
      json({ error: "A page already exists at this path" }, 400),
    );
    const { result } = renderHook(() => useCreateApp("/api/apps/"));
    let path: string | undefined;

    await act(async () => {
      path = await result.current.create({ name: "Queue", prompt: "A queue" });
    });

    expect(path).toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/apps/pages");
    expect(result.current.error).toBe(
      "There's already an app at /queue. Choose another name.",
    );
    expect(result.current.isCreating).toBe(false);
  });

  it("reports other failures", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")));
    const { result } = renderHook(() => useCreateApp());

    await act(async () => {
      await result.current.create({ name: "Queue", prompt: "A queue" });
    });

    expect(result.current.error).toBe(
      "Your app couldn't be created. Try again.",
    );
  });
});
