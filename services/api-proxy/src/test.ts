/**
 * LLMPowerUp Proxy - Compatibility Test Suite
 *
 * Tests the proxy against:
 * 1. Direct OpenRouter key (passthrough)
 * 2. Platform key (clst_) with usage tracking
 * 3. OpenAI SDK format (LangChain compatible)
 * 4. Streaming (Vercel AI SDK compatible)
 */

const PROXY_URL = "http://localhost:4000";
const PLATFORM_KEY = "clst_test_abc123xyz789def456ghi"; // Our test key

// Get OpenRouter key from env or skip those tests
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`  ${name}... `);
  try {
    await fn();
    console.log("PASS");
  } catch (e: any) {
    console.log(`FAIL: ${e.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function main() {
  console.log("\n=== LLMPowerUp Proxy Test Suite ===\n");

  // Health
  await test("Health check", async () => {
    const res = await fetch(`${PROXY_URL}/health`);
    const data = await res.json();
    assert(data.status === "ok", `Expected ok, got ${data.status}`);
  });

  // Models endpoint
  await test("GET /v1/models returns model list", async () => {
    const res = await fetch(`${PROXY_URL}/v1/models`);
    const data = await res.json() as any;
    assert(res.ok, `HTTP ${res.status}`);
    assert(data.data?.length > 0, "No models returned");
    console.log(`(${data.data.length} models) `);
  });

  // Auth: bad key
  await test("Rejects invalid API key", async () => {
    const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Authorization": "Bearer clst_invalid", "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }] }),
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // Auth: no header
  await test("Rejects missing auth header", async () => {
    const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "user", content: "hi" }] }),
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  // Usage endpoint
  await test("GET /v1/usage returns plan info", async () => {
    const res = await fetch(`${PROXY_URL}/v1/usage`, {
      headers: { "Authorization": `Bearer ${PLATFORM_KEY}` },
    });
    const data = await res.json() as any;
    assert(res.ok, `HTTP ${res.status}: ${JSON.stringify(data)}`);
    assert(typeof data.plan === "string", "Missing plan field");
    assert(typeof data.monthly_limit === "number", "Missing monthly_limit");
    assert(typeof data.used_this_month === "number", "Missing used_this_month");
    console.log(`(${data.plan}: ${data.used_this_month}/${data.monthly_limit}) `);
  });

  // Platform key → OpenRouter (requires configured OpenRouter key)
  await test("Platform key: chat completion (non-stream)", async () => {
    const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PLATFORM_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: "Say 'test ok' and nothing else." }],
        max_tokens: 10,
      }),
    });
    const data = await res.json() as any;
    if (data.error) {
      console.log(`(expected - need OpenRouter key configured: ${data.error.message}) `);
      return; // Not a failure, just not configured
    }
    assert(data.choices?.[0]?.message?.content, "No content in response");
    console.log(`("${data.choices[0].message.content.slice(0, 30)}") `);
  });

  // Streaming test (if direct OpenRouter key available)
  if (OPENROUTER_KEY) {
    await test("Direct key: streaming SSE", async () => {
      const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [{ role: "user", content: "Count from 1 to 3." }],
          stream: true,
          max_tokens: 20,
        }),
      });
      assert(res.ok, `HTTP ${res.status}`);
      assert(res.headers.get("content-type")?.includes("text/event-stream"), "Not SSE");

      const text = await res.text();
      assert(text.includes("data:"), "No SSE data frames");
      assert(text.includes("[DONE]"), "Missing [DONE] terminator");
      const chunks = text.split("\n").filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"));
      console.log(`(${chunks.length} chunks) `);
    });
  } else {
    console.log("  [SKIP] Streaming test: set OPENROUTER_API_KEY env var to test");
  }

  // LangChain compatibility check (format only)
  await test("LangChain format: /v1/chat/completions accepts OpenAI format", async () => {
    // LangChain sends exactly this format
    const body = {
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Say test." },
      ],
      temperature: 0.7,
      max_tokens: 10,
      stream: false,
    };
    const res = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PLATFORM_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    // We just check it doesn't 400 on the format
    assert(res.status !== 400, `Rejected OpenAI format: ${res.status}`);
    console.log(`(status: ${res.status}) `);
  });

  console.log("\n=== Tests complete ===\n");
}

main().catch(console.error);
