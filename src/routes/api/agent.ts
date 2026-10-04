import { createFileRoute } from "@tanstack/react-router";
import { agentStatus, handleAgentRequest } from "@/lib/agent/server";

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      GET: () => Response.json(agentStatus()),
      POST: ({ request }) => handleAgentRequest(request),
    },
  },
});
