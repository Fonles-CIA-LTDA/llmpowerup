import { Hono } from "hono";
import { cors } from "hono/cors";

import { serve } from "@hono/node-server";
import { createClient } from "@supabase/supabase-js";

// --- Config ---
const PORT = parseInt(process.env.PORT || "4000");
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const RUST_BACKEND = process.env.RUST_BACKEND || "http://localhost:3001";
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Plan limits ---
const PLANS: Record<string, { monthlyReqs: number; rpm: number; concurrent: number }> = {
  free:       { monthlyReqs: 100,    rpm: 5,   concurrent: 1 },
  pro:        { monthlyReqs: 10_000, rpm: 60,  concurrent: 10 },
  enterprise: { monthlyReqs: 100_000, rpm: 300, concurrent: 50 },
};

// --- Rate limiter (in-memory, per tenant) ---
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(tenantId: string, rpm: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(tenantId);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(tenantId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= rpm) return false;
  bucket.count++;
  return true;
}

// --- Auth: resolve tenant from API key ---
async function authTenant(apiKey: string) {
  const encoded = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: row } = await supabase
    .from("api_keys")
    .select("tenant_id, permissions, system_prompt, tenants!inner(id, plan, rate_limit_rpm, max_concurrent, is_active, default_system_prompt)")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .single();

  if (!row) return null;
  const tenant = (row as any).tenants;
  if (!tenant?.is_active) return null;

  // System prompt priority: per-key > tenant default > none
  const systemPrompt = (row as any).system_prompt || tenant.default_system_prompt || null;

  return {
    tenantId: tenant.id as string,
    plan: tenant.plan as string,
    systemPrompt: systemPrompt as string | null,
  };
}

// --- Check monthly usage ---
async function getMonthlyUsage(tenantId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("usage_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("event_type", "request")
    .gte("created_at", monthStart.toISOString());

  return count || 0;
}

// --- Record usage ---
async function recordUsage(tenantId: string) {
  await supabase.from("usage_events").insert({
    tenant_id: tenantId,
    event_type: "request",
    credits: 1,
  });
}

// --- Get OpenRouter key for tenant ---
async function getOpenRouterKey(tenantId: string): Promise<string | null> {
  // Use raw SQL via rpc to read bytea properly
  const { data, error } = await supabase.rpc("get_openrouter_key", { p_tenant_id: tenantId });
  if (error || !data) {
    // Fallback: direct query
    const { data: row } = await supabase
      .from("provider_credentials")
      .select("encrypted_key")
      .eq("tenant_id", tenantId)
      .eq("provider_id", "openrouter")
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!row) return null;
    // Supabase returns bytea as hex string like "\\x736b2d6f72..."
    const raw = row.encrypted_key;
    if (typeof raw === "string") {
      if (raw.startsWith("\\x")) {
        const hex = raw.slice(2);
        const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
        return new TextDecoder().decode(bytes);
      }
      return raw;
    }
    if (Array.isArray(raw)) {
      return new TextDecoder().decode(new Uint8Array(raw));
    }
    return null;
  }
  return data as string;
}

// ============================================================
// APP
// ============================================================
const app = new Hono();
app.use("*", cors());

// --- Health ---
app.get("/health", (c) => c.json({ status: "ok", service: "llmpowerup-proxy", version: "1.0.0" }));

// --- Models (proxy to OpenRouter) ---
app.get("/v1/models", async (c) => {
  const res = await fetch(`${OPENROUTER_BASE}/models`);
  const data = await res.json();
  return c.json(data);
});

// --- Chat Completions (the main proxy endpoint) ---
// Compatible with: OpenAI SDK, Vercel AI SDK, LangChain
app.post("/v1/chat/completions", async (c) => {
  // 1. Auth
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: { message: "Missing Authorization: Bearer <key>", type: "unauthorized" } }, 401);
  }
  const apiKey = authHeader.slice(7);

  // Support both our keys (clst_) and direct OpenRouter keys (sk-or-)
  let openRouterKey: string;
  let tenantId: string | null = null;

  if (apiKey.startsWith("clst_")) {
    // Our platform key — resolve tenant, check limits, proxy to OpenRouter
    const tenant = await authTenant(apiKey);
    if (!tenant) {
      return c.json({ error: { message: "Invalid API key", type: "unauthorized" } }, 401);
    }
    tenantId = tenant.tenantId;
    const plan = PLANS[tenant.plan] || PLANS.free;

    // Rate limit
    if (!checkRateLimit(tenantId, plan.rpm)) {
      return c.json({ error: { message: `Rate limit: ${plan.rpm} req/min. Upgrade for more.`, type: "rate_limit" } }, 429);
    }

    // Monthly limit (free plan hard-blocked, paid plans allowed)
    const used = await getMonthlyUsage(tenantId);
    if (tenant.plan === "free" && used >= plan.monthlyReqs) {
      return c.json({
        error: { message: `Monthly limit reached (${plan.monthlyReqs} requests). Upgrade to Pro for 10,000 req/mo.`, type: "usage_limit" },
      }, 429);
    }

    // Get their OpenRouter key
    const orKey = await getOpenRouterKey(tenantId);
    if (!orKey) {
      return c.json({
        error: { message: "No OpenRouter API key configured. Add one in Dashboard > Providers.", type: "configuration_error" },
      }, 400);
    }
    openRouterKey = orKey;
  } else {
    // Direct OpenRouter key passthrough (for testing)
    openRouterKey = apiKey;
  }

  // 2. Forward request to OpenRouter (inject system prompt if configured)
  const rawBody = await c.req.text();
  const parsed = JSON.parse(rawBody);
  const isStream = parsed.stream === true;

  // Inject system prompt: per-key/tenant default prepended if no system message exists
  if (apiKey.startsWith("clst_")) {
    const tenant = await authTenant(apiKey); // already called above but cheap
    if (tenant?.systemPrompt && parsed.messages?.length > 0) {
      const hasSystemMsg = parsed.messages.some((m: any) => m.role === "system");
      if (!hasSystemMsg) {
        parsed.messages.unshift({ role: "system", content: tenant.systemPrompt });
      }
    }
  }
  const body = JSON.stringify(parsed);

  // Record usage (fire-and-forget)
  if (tenantId) recordUsage(tenantId);

  const orResponse = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openRouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://llmpowerup.com",
      "X-Title": "LLMPowerUp Cloud",
    },
    body,
  });

  // 3. Return response
  if (!isStream) {
    const data = await orResponse.json();
    return c.json(data, orResponse.status as any);
  }

  // Streaming: passthrough OpenRouter's SSE response directly
  // We return a raw Response with CORS headers to ensure browsers can read the stream
  if (!orResponse.body) {
    return c.json({ error: { message: "No stream from provider", type: "provider_error" } }, 502);
  }

  return new Response(orResponse.body as any, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
    },
  });
});

// --- Usage endpoint ---
app.get("/v1/usage", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer clst_")) {
    return c.json({ error: { message: "Unauthorized", type: "unauthorized" } }, 401);
  }

  const tenant = await authTenant(authHeader.slice(7));
  if (!tenant) return c.json({ error: { message: "Invalid key", type: "unauthorized" } }, 401);

  const plan = PLANS[tenant.plan] || PLANS.free;
  const used = await getMonthlyUsage(tenant.tenantId);

  return c.json({
    plan: tenant.plan,
    monthly_limit: plan.monthlyReqs,
    used_this_month: used,
    remaining: Math.max(plan.monthlyReqs - used, 0),
    rate_limit_rpm: plan.rpm,
  });
});

// ============================================================
// AGENT MODE — Full LLMPowerUp power (Rust backend)
// Uses run_query_loop() with all 42 tools
// ============================================================

// --- Agent Run (proxies to Rust backend with full tool execution) ---
app.post("/v1/agent/run", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: { message: "Missing Authorization", type: "unauthorized" } }, 401);
  }
  const apiKey = authHeader.slice(7);

  // Auth
  if (apiKey.startsWith("clst_")) {
    const tenant = await authTenant(apiKey);
    if (!tenant) return c.json({ error: { message: "Invalid API key", type: "unauthorized" } }, 401);
    const plan = PLANS[tenant.plan] || PLANS.free;

    if (!checkRateLimit(tenant.tenantId, plan.rpm)) {
      return c.json({ error: { message: `Rate limit: ${plan.rpm} req/min`, type: "rate_limit" } }, 429);
    }
    const used = await getMonthlyUsage(tenant.tenantId);
    if (tenant.plan === "free" && used >= plan.monthlyReqs) {
      return c.json({ error: { message: "Monthly limit reached", type: "usage_limit" } }, 429);
    }
    recordUsage(tenant.tenantId);
  }

  // Forward to Rust backend (which runs run_query_loop with all 42 tools)
  const body = await c.req.text();
  const rustRes = await fetch(`${RUST_BACKEND}/v1/agent/run`, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    },
    body,
  });

  // Stream SSE response through
  if (rustRes.headers.get("content-type")?.includes("text/event-stream") && rustRes.body) {
    return new Response(rustRes.body as any, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const data = await rustRes.json();
  return c.json(data, rustRes.status as any);
});

// --- Tools list (from Rust backend — real 42 tools) ---
app.get("/v1/tools", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const rustRes = await fetch(`${RUST_BACKEND}/v1/tools`, {
    headers: { "Authorization": authHeader },
  });
  const data = await rustRes.json();
  return c.json(data, rustRes.status as any);
});

// --- Sessions (from Rust backend) ---
app.get("/v1/sessions", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const rustRes = await fetch(`${RUST_BACKEND}/v1/sessions`, {
    headers: { "Authorization": authHeader },
  });
  const data = await rustRes.json();
  return c.json(data, rustRes.status as any);
});

app.post("/v1/sessions", async (c) => {
  const authHeader = c.req.header("Authorization") || "";
  const body = await c.req.text();
  const rustRes = await fetch(`${RUST_BACKEND}/v1/sessions`, {
    method: "POST",
    headers: { "Authorization": authHeader, "Content-Type": "application/json" },
    body,
  });
  const data = await rustRes.json();
  return c.json(data, rustRes.status as any);
});

// --- Start ---
console.log(`LLMPowerUp Proxy starting on port ${PORT}...`);
serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`LLMPowerUp Proxy running at http://localhost:${info.port}`);
  console.log(`  Health:     http://localhost:${info.port}/health`);
  console.log(`  Models:     http://localhost:${info.port}/v1/models`);
  console.log(`  Chat:       POST http://localhost:${info.port}/v1/chat/completions`);
  console.log(`  Usage:      http://localhost:${info.port}/v1/usage`);
  console.log("");
  console.log("Compatible with: OpenAI SDK, Vercel AI SDK, LangChain");
});
