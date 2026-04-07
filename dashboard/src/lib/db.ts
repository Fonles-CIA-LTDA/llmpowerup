import { createClient } from "./supabase";

const supabase = createClient();

export async function getTenant() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("tenants")
    .select("*")
    .eq("supabase_uid", user.id)
    .single();

  return data;
}

export async function getUsageStats(tenantId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { count: monthlyCount } = await supabase
    .from("usage_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("event_type", "request")
    .gte("created_at", monthStart);

  const { count: dailyCount } = await supabase
    .from("usage_events")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("event_type", "request")
    .gte("created_at", dayStart);

  return {
    monthly: monthlyCount || 0,
    daily: dailyCount || 0,
  };
}

export async function getSessions(tenantId: string) {
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  return data || [];
}

export async function deleteSession(sessionId: string, tenantId: string) {
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("tenant_id", tenantId);

  return !error;
}

export async function getApiKeys(tenantId: string) {
  const { data } = await supabase
    .from("api_keys")
    .select("id, key_prefix, name, is_active, last_used, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  return data || [];
}

export async function revokeApiKey(keyId: string, tenantId: string) {
  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", keyId)
    .eq("tenant_id", tenantId);

  return !error;
}

export async function getProviderCredentials(tenantId: string) {
  const { data } = await supabase
    .from("provider_credentials")
    .select("id, provider_id, api_base, is_default, label, created_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  return data || [];
}

export type Tenant = {
  id: string;
  email: string;
  display_name: string | null;
  plan: string;
  rate_limit_rpm: number;
  max_concurrent: number;
  stripe_customer_id: string | null;
  default_system_prompt: string | null;
};

const PLAN_LIMITS: Record<string, number> = {
  free: 100,
  pro: 10000,
  enterprise: 100000,
};

export function getPlanLimit(plan: string): number {
  return PLAN_LIMITS[plan] || 100;
}
