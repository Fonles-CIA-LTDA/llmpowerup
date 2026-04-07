# Supabase Setup Guide

LLMPowerUp uses Supabase for authentication, database, and credential storage. Follow these steps to set up your Supabase project.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and keys from **Project Settings > API**:
   - `Project URL` → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT Secret` → `SUPABASE_JWT_SECRET`
3. Get your database connection string from **Project Settings > Database**:
   - `Connection string` → `DATABASE_URL`

## 2. Run the Database Migration

Go to **SQL Editor** in your Supabase dashboard and run the migration:

```sql
-- Copy and paste the contents of:
-- src-rust/crates/server/migrations/001_initial_schema.sql
```

This creates the required tables:
- `tenants` — workspace accounts
- `api_keys` — API keys (SHA-256 hashed)
- `provider_credentials` — encrypted LLM provider keys
- `sessions` — conversation sessions
- `messages` — message history
- `usage_events` — request tracking

## 3. Create the RPC Function

The dashboard uses an RPC function to safely retrieve provider keys. Run this in the SQL Editor:

```sql
CREATE OR REPLACE FUNCTION get_openrouter_key(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT;
BEGIN
  SELECT convert_from(encrypted_key, 'UTF8')
  INTO v_key
  FROM provider_credentials
  WHERE tenant_id = p_tenant_id
    AND provider_id = 'openrouter'
    AND is_active = TRUE
  LIMIT 1;

  RETURN v_key;
END;
$$;
```

## 4. Enable Auth

1. Go to **Authentication > Providers**
2. Enable **Email** provider (enabled by default)
3. Optionally enable Google, GitHub, etc.

## 5. Configure Row Level Security (RLS)

Enable RLS on all tables and add policies so users can only access their own tenant data:

```sql
-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Tenants: users can read their own tenant
CREATE POLICY "Users can view own tenant"
  ON tenants FOR SELECT
  USING (id = auth.uid());

-- API Keys: users can manage their own keys
CREATE POLICY "Users can manage own api_keys"
  ON api_keys FOR ALL
  USING (tenant_id = auth.uid());

-- Provider Credentials: users can manage their own credentials
CREATE POLICY "Users can manage own credentials"
  ON provider_credentials FOR ALL
  USING (tenant_id = auth.uid());

-- Sessions: users can view their own sessions
CREATE POLICY "Users can view own sessions"
  ON sessions FOR SELECT
  USING (tenant_id = auth.uid());

-- Usage: users can view their own usage
CREATE POLICY "Users can view own usage"
  ON usage_events FOR SELECT
  USING (tenant_id = auth.uid());
```

## 6. Set Environment Variables

Copy the `.env.example` files and fill in your Supabase values:

```bash
# Rust backend
cp src-rust/crates/server/.env.example src-rust/crates/server/.env

# API proxy
cp services/api-proxy/.env.example services/api-proxy/.env

# Dashboard
cp dashboard/.env.example dashboard/.env.local
```

## 7. Create Your First Tenant

After setting up auth, register via the dashboard. A tenant record is created automatically on signup. Then add your OpenRouter API key in **Dashboard > Providers**.
