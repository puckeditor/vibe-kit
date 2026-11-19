import { z } from "zod/v4";
import { defineVibeKit } from "../define-vibe-kit";

export const ticket = z.object({
  id: z.string(),
  subject: z.string(),
  status: z.enum(["open", "closed"]),
  total: z.number().meta({ format: "currency", title: "Order total" }),
});

export const kit = defineVibeKit({
  reads: {
    listTickets: {
      description: "Support tickets.",
      input: z.object({
        status: z.enum(["open", "closed"]).optional(),
        assignee: z.string().optional(),
      }),
      output: z.array(ticket),
    },
    getMetrics: {
      label: "Metrics",
      description: "Headline numbers.",
      output: z.object({ openTickets: z.number(), team: z.string() }),
    },
  },
  writes: {
    closeTicket: {
      description: "Close a ticket.",
      input: z.object({ id: z.string() }),
      output: z.object({ id: z.string() }),
      confirm: "Close this ticket?",
    },
  },
  ai: { context: "We are Acme." },
});
