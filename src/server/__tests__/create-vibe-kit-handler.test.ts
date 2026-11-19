import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, puckHandler } = vi.hoisted(() => ({
  getSession: vi.fn(),
  puckHandler: vi.fn(async () => Response.json({ from: "puckHandler" })),
}));

vi.mock("@puckeditor/cloud-client", () => ({
  puckCloud: () => ({ auth: { getSession } }),
  puckHandler,
  tool: (definition: unknown) => definition,
}));

import { createVibeKitHandler } from "../create-vibe-kit-handler";
import { VibeKitError } from "../vibe-kit-error";
import { VIBE_KIT_HEADER } from "../../lib/constants";
import { defineVibeKit } from "../../define-vibe-kit";
import { kit } from "../../__tests__/helpers";

const user = { id: "user_1", name: "Ada", email: "ada@example.com" };

const tickets = [
  {
    id: "t1",
    subject: "Login",
    status: "open" as const,
    total: 1,
    secret: "hidden",
  },
];

const reads = {
  listTickets: vi.fn(() => tickets),
  getMetrics: vi.fn(() => ({ openTickets: 1, team: "Support" })),
};

const writes = {
  closeTicket: vi.fn(({ id }: { id: string }) => ({ id })),
};

const post = (
  path: string,
  body?: unknown,
  headers: Record<string, string> = { [VIBE_KIT_HEADER]: "1" },
) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body ?? {}),
  });

const handler = createVibeKitHandler(kit, {
  reads,
  writes,
  context: () => ({ user }),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reads", () => {
  it("returns only the fields the output declares", async () => {
    const response = await handler(
      post("/api/puck/reads/listTickets", { input: { status: "open" } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [{ id: "t1", subject: "Login", status: "open", total: 1 }],
    });
    expect(reads.listTickets).toHaveBeenCalledWith(
      { status: "open" },
      { user },
    );
  });

  it("drops empty input values", async () => {
    await handler(
      post("/api/puck/reads/listTickets", {
        input: { status: "", assignee: null },
      }),
    );

    expect(reads.listTickets).toHaveBeenCalledWith({}, { user });
  });

  it("refuses input that doesn't match the schema", async () => {
    const response = await handler(
      post("/api/puck/reads/listTickets", { input: { status: "lost" } }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid input for listTickets",
      issues: [{ path: ["status"] }],
    });
    expect(reads.listTickets).not.toHaveBeenCalled();
  });

  it("fails when the handler returns the wrong shape", async () => {
    reads.getMetrics.mockReturnValueOnce({ openTickets: "many" } as never);
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    const response = await handler(post("/api/puck/reads/getMetrics"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "getMetrics returned data that doesn't match its output schema",
    });
  });

  it("answers 404 for an API the kit doesn't have", async () => {
    const response = await handler(post("/api/puck/reads/constructor"));

    expect(response.status).toBe(404);
  });

  it("only answers POST", async () => {
    const response = await handler(
      new Request("http://localhost/api/puck/reads/listTickets"),
    );

    expect(response.status).toBe(405);
  });

  it("refuses requests from anything but the kit's client", async () => {
    const response = await handler(post("/api/puck/reads/listTickets", {}, {}));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Call the kit's APIs with vibeKit, not fetch",
    });
    expect(reads.listTickets).not.toHaveBeenCalled();
  });
});

describe("writes", () => {
  it("runs the handler", async () => {
    const response = await handler(
      post("/api/puck/writes/closeTicket", { input: { id: "t1" } }),
    );

    expect(await response.json()).toEqual({ data: { id: "t1" } });
    expect(writes.closeTicket).toHaveBeenCalledWith({ id: "t1" }, { user });
  });

  it("only checks the input on a dry run", async () => {
    const response = await handler(
      post("/api/puck/writes/closeTicket", {
        input: { id: "t1" },
        dryRun: true,
      }),
    );

    expect(await response.json()).toEqual({ data: null, dryRun: true });
    expect(writes.closeTicket).not.toHaveBeenCalled();
  });

  it("checks the input on a dry run too", async () => {
    const response = await handler(
      post("/api/puck/writes/closeTicket", { input: {}, dryRun: true }),
    );

    expect(response.status).toBe(400);
  });

  it("sends an VibeKitError's message and status", async () => {
    writes.closeTicket.mockImplementationOnce(() => {
      throw new VibeKitError("Ask finance", 403);
    });

    const response = await handler(
      post("/api/puck/writes/closeTicket", { input: { id: "t1" } }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Ask finance" });
  });

  it("hides other errors", async () => {
    writes.closeTicket.mockImplementationOnce(() => {
      throw new Error("Database password is hunter2");
    });
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    const response = await handler(
      post("/api/puck/writes/closeTicket", { input: { id: "t1" } }),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "closeTicket failed" });
  });
});

describe("context", () => {
  it("refuses calls without a context", async () => {
    const signedOut = createVibeKitHandler(kit, {
      reads,
      writes,
      context: () => null,
    });

    const response = await signedOut(post("/api/puck/reads/listTickets"));

    expect(response.status).toBe(401);
    expect(reads.listTickets).not.toHaveBeenCalled();
  });

  it("defaults to the Sign in with Puck user", async () => {
    getSession.mockResolvedValueOnce({ user, branch: "main" });

    const request = post("/api/puck/reads/listTickets");

    await createVibeKitHandler(kit, { reads, writes })(request);

    expect(getSession).toHaveBeenCalledWith(request);
    expect(reads.listTickets).toHaveBeenCalledWith({}, { user });
  });
});

describe("other routes", () => {
  it("go to puckHandler with Sign in with Puck and the kit's AI options", async () => {
    const request = post("/api/puck/chat");
    const response = await handler(request);

    expect(await response.json()).toEqual({ from: "puckHandler" });

    const [, options] = puckHandler.mock.calls[0] as unknown as [
      Request,
      Record<string, any>,
    ];

    expect(options.auth).toEqual({ provider: "puck" });
    expect(options.ai.context).toMatch(/^We are Acme\.\n\n## Data APIs/);
    expect(options.ai.tools).toBeUndefined();
  });

  it("let the puck options override the defaults", async () => {
    await createVibeKitHandler(kit, {
      reads,
      writes,
      puck: { auth: { tenantId: "t" }, ai: { context: "Mine" } },
    })(post("/api/puck/chat"));

    const [, options] = puckHandler.mock.calls[0] as unknown as [
      Request,
      Record<string, any>,
    ];

    expect(options.auth).toEqual({ tenantId: "t" });
    expect(options.ai.context).toBe("Mine");
  });

  it("keep apps designed, with scripts, whatever the puck options say", async () => {
    await createVibeKitHandler(kit, {
      reads,
      writes,
      puck: {
        ai: { mode: "assembly", designMode: { scripts: false } },
      },
    })(post("/api/puck/chat"));

    const [, options] = puckHandler.mock.calls[0] as unknown as [
      Request,
      Record<string, any>,
    ];

    expect(options.ai.mode).toBe("design");
    expect(options.ai.designMode.scripts).toBe(true);
    expect(options.ai.designMode.instructions).toContain("## Data in scripts");
  });

  it("give the AI a tool per read when the rules allow reading data", async () => {
    const readingKit = defineVibeKit({ ...kit, ai: { readData: true } });

    await createVibeKitHandler(readingKit, {
      reads,
      writes,
      context: () => ({ user }),
    })(post("/api/puck/chat"));

    const [, options] = puckHandler.mock.calls[0] as unknown as [
      Request,
      Record<string, any>,
    ];

    expect(Object.keys(options.ai.tools)).toEqual([
      "listTickets",
      "getMetrics",
    ]);
    expect(
      await options.ai.tools.listTickets.execute({
        status: null,
        assignee: null,
      }),
    ).toEqual([{ id: "t1", subject: "Login", status: "open", total: 1 }]);
    expect(reads.listTickets).toHaveBeenCalledWith({}, { user });
  });
});
