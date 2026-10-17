import { NextResponse } from "next/server";
import { verifyMcpAuth } from "@/lib/mcp-auth";
import { POST as handleMcpPost } from "../route";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-mcp-key, x-api-key",
};

/**
 * SSE Transport for Model Context Protocol (MCP 2024-11-05 standard)
 */
export async function GET(request: Request) {
  const auth = await verifyMcpAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const encoder = new TextEncoder();
  const sessionId = `mcp_sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const stream = new ReadableStream({
    start(controller) {
      // Send standard MCP endpoint event containing the URI where client posts JSON-RPC messages
      controller.enqueue(encoder.encode(`event: endpoint\ndata: /api/mcp?sessionId=${sessionId}\n\n`));

      // Heartbeat ping every 25 seconds to keep connection alive
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
      ...CORS_HEADERS,
    },
  });
}

/**
 * Handle direct POST on SSE endpoint (supported by various MCP client libraries)
 */
export async function POST(request: Request) {
  return handleMcpPost(request);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
