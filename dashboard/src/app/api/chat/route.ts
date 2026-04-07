export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROXY_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function POST(req: Request) {
  const body = await req.text();
  const authHeader = req.headers.get("authorization") || "";

  const upstream = await fetch(`${PROXY_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => "Upstream error");
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check if streaming
  const parsed = JSON.parse(body);
  if (!parsed.stream) {
    const data = await upstream.text();
    return new Response(data, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Streaming: create a ReadableStream that reads from upstream and forwards
  const encoder = new TextEncoder();
  const upstreamReader = upstream.body?.getReader();

  if (!upstreamReader) {
    return Response.json({ error: { message: "No upstream stream" } }, { status: 502 });
  }

  const readableStream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch {
        controller.close();
      }
    },
    cancel() {
      upstreamReader.cancel();
    },
  });

  return new Response(readableStream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
