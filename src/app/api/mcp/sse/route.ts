import { NextResponse } from "next/server";
import { verifyMcpAuth } from "@/lib/mcp-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await verifyMcpAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();
  const sessionId = `mcp_sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial endpoint event
      const endpointData = JSON.stringify({
        endpoint: `/api/mcp?sessionId=${sessionId}`,
        session: sessionId,
        authenticatedUser: auth.name,
        orgId: auth.orgId,
      });
      controller.enqueue(encoder.encode(`event: endpoint\ndata: ${endpointData}\n\n`));

      // Heartbeat every 25 seconds
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(interval);
        }
      }, 25000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key, x-api-key",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key, x-api-key",
    },
  });
}
