export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const BACKEND_URL = process.env.AGENT_BACKEND_URL || "http://localhost:4000";

export async function POST(req: Request) {
  let res: Response;

  try {
    res = await fetch(`${BACKEND_URL}/v1/agent/run`, {
      method: "POST",
      headers: {
        "Authorization": req.headers.get("authorization") || "",
        "Content-Type": "application/json",
      },
      body: await req.text(),
      signal: AbortSignal.timeout(300_000),
    });
  } catch (e: any) {
    return Response.json(
      { error: { message: `Backend unreachable at ${BACKEND_URL}: ${e.message}`, type: "connection_error" } },
      { status: 502 },
    );
  }

  // Forward non-OK responses as-is
  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    return new Response(body, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json" },
    });
  }

  // SSE stream — pipe through directly
  if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  }

  // JSON fallback
  const body = await res.text();
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
