-- CLAURST SaaS Platform - Initial Schema
-- Run this in your Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supabase_uid        UUID NOT NULL UNIQUE,
    email               TEXT NOT NULL,
    display_name        TEXT,
    company             TEXT,
    plan                TEXT NOT NULL DEFAULT 'free',  -- 'free', 'pro', 'enterprise'
    stripe_customer_id  TEXT UNIQUE,
    stripe_subscription_id TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    rate_limit_rpm      INT NOT NULL DEFAULT 30,
    max_concurrent      INT NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata            JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_self ON tenants USING (supabase_uid = auth.uid());

-- ============================================================
-- API KEYS
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_hash    TEXT NOT NULL UNIQUE,
    key_prefix  TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT 'default',
    permissions JSONB DEFAULT '["*"]'::jsonb,
    rate_limit  INT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    last_used   TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_keys_tenant ON api_keys
    USING (tenant_id IN (SELECT id FROM tenants WHERE supabase_uid = auth.uid()));

-- ============================================================
-- PROVIDER CREDENTIALS (BYOK - encrypted)
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_credentials (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider_id     TEXT NOT NULL,
    encrypted_key   BYTEA NOT NULL,
    api_base        TEXT,
    is_default      BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    label           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider_id, label)
);

ALTER TABLE provider_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY creds_tenant ON provider_credentials
    USING (tenant_id IN (SELECT id FROM tenants WHERE supabase_uid = auth.uid()));

-- ============================================================
-- SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    title           TEXT,
    model           TEXT NOT NULL,
    provider_id     TEXT NOT NULL DEFAULT 'anthropic',
    system_prompt   TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    message_count   INT NOT NULL DEFAULT 0,
    total_tokens    BIGINT NOT NULL DEFAULT 0,
    total_cost_usd  DOUBLE PRECISION NOT NULL DEFAULT 0,
    credits_used    BIGINT NOT NULL DEFAULT 0,
    config          JSONB DEFAULT '{}'::jsonb,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX idx_sessions_tenant ON sessions(tenant_id, created_at DESC);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY sessions_tenant ON sessions
    USING (tenant_id IN (SELECT id FROM tenants WHERE supabase_uid = auth.uid()));

-- ============================================================
-- MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     JSONB NOT NULL,
    usage       JSONB,
    cost        JSONB,
    turn        INT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_session ON messages(session_id, turn);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_tenant ON messages
    USING (tenant_id IN (SELECT id FROM tenants WHERE supabase_uid = auth.uid()));

-- ============================================================
-- AGENT RUNS
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_runs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
    model           TEXT NOT NULL,
    provider_id     TEXT NOT NULL,
    tools_used      TEXT[] DEFAULT '{}',
    turn_count      INT NOT NULL DEFAULT 0,
    credits_used    BIGINT NOT NULL DEFAULT 0,
    credits_reserved BIGINT NOT NULL DEFAULT 0,
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_tenant ON agent_runs(tenant_id, created_at DESC);
CREATE INDEX idx_agent_runs_active ON agent_runs(tenant_id) WHERE status IN ('pending', 'running');

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY runs_tenant ON agent_runs
    USING (tenant_id IN (SELECT id FROM tenants WHERE supabase_uid = auth.uid()));

-- ============================================================
-- USAGE EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_events (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_id  UUID REFERENCES sessions(id) ON DELETE SET NULL,
    run_id      UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL,
    credits     BIGINT NOT NULL,
    metadata    JSONB DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_tenant_time ON usage_events(tenant_id, created_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_tenant ON usage_events
    USING (tenant_id IN (SELECT id FROM tenants WHERE supabase_uid = auth.uid()));

-- ============================================================
-- CREDIT TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    amount          BIGINT NOT NULL,
    balance_after   BIGINT NOT NULL,
    type            TEXT NOT NULL,
    stripe_payment_id TEXT,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY txn_tenant ON credit_transactions
    USING (tenant_id IN (SELECT id FROM tenants WHERE supabase_uid = auth.uid()));

-- ============================================================
-- CUSTOM TOOLS
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_tools (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL,
    tool_type   TEXT NOT NULL,
    config      JSONB NOT NULL,
    input_schema JSONB NOT NULL,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

ALTER TABLE custom_tools ENABLE ROW LEVEL SECURITY;
CREATE POLICY tools_tenant ON custom_tools
    USING (tenant_id IN (SELECT id FROM tenants WHERE supabase_uid = auth.uid()));

-- ============================================================
-- ATOMIC CREDIT FUNCTIONS
-- ============================================================

-- Deduct credits atomically with overdraft prevention
CREATE OR REPLACE FUNCTION deduct_credits(
    p_tenant_id UUID,
    p_amount BIGINT,
    p_event_type TEXT,
    p_session_id UUID DEFAULT NULL,
    p_run_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BOOLEAN AS $$
DECLARE
    v_new_balance BIGINT;
BEGIN
    UPDATE tenants
    SET credit_balance = credit_balance - p_amount,
        updated_at = NOW()
    WHERE id = p_tenant_id
      AND credit_balance >= p_amount
      AND is_active = TRUE
    RETURNING credit_balance INTO v_new_balance;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    INSERT INTO usage_events (tenant_id, session_id, run_id, event_type, credits, metadata)
    VALUES (p_tenant_id, p_session_id, p_run_id, p_event_type, p_amount, p_metadata);

    INSERT INTO credit_transactions (tenant_id, amount, balance_after, type, description)
    VALUES (p_tenant_id, -p_amount, v_new_balance, 'usage', p_event_type);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Reserve credits for long-running agent runs
CREATE OR REPLACE FUNCTION reserve_credits(
    p_tenant_id UUID,
    p_amount BIGINT
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tenants
    SET credit_balance = credit_balance - p_amount,
        credit_reserved = credit_reserved + p_amount,
        updated_at = NOW()
    WHERE id = p_tenant_id
      AND credit_balance >= p_amount
      AND is_active = TRUE;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Release unused reserved credits after run completion
CREATE OR REPLACE FUNCTION release_credits(
    p_tenant_id UUID,
    p_amount_used BIGINT,
    p_amount_reserved BIGINT
) RETURNS VOID AS $$
DECLARE
    v_refund BIGINT := p_amount_reserved - p_amount_used;
BEGIN
    UPDATE tenants
    SET credit_reserved = GREATEST(credit_reserved - p_amount_reserved, 0),
        credit_balance = credit_balance + GREATEST(v_refund, 0),
        updated_at = NOW()
    WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql;
