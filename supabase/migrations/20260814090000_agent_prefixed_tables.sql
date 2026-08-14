/*
# Trip agent tables, `agent_` prefixed

Supersedes 20260813205053_create_conversations_and_messages.sql, which created
unprefixed `conversations` / `messages`. This migration creates the prefixed
tables the backend and UI now use, copies over any existing rows, and drops the
old tables.

Mirrors trip-agent/migrations/001_agent_tables.sql — keep the two in step.

1. New tables
- `agent_conversations` : chat threads. The row id IS the LangGraph thread_id.
- `agent_messages`      : chat history, with `interrupt_data` for a pending
                          human-in-the-loop pick and `tool_calls` for the
                          lookups a turn ran.
- `agent_user_memory`   : cross-thread durable preferences, keyed (user_id, key).
- `agent_selection_log` : audit trail of every interrupt and its outcome.

2. Security
- RLS on all four. Direct ownership via auth.uid() on conversations and memory;
  messages and the selection log inherit ownership through the parent
  conversation. The backend uses the service role key and bypasses RLS by
  design, which is why it enforces the same scoping in code.
*/

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'New conversation',
  preview     text NOT NULL DEFAULT '',
  turn_count  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
  content         text NOT NULL DEFAULT '',
  interrupt_data  jsonb,
  tool_calls      jsonb,
  turn_index      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_user_memory (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS agent_selection_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  selection_id    text NOT NULL,
  kind            text NOT NULL,
  destination     text,
  options         jsonb NOT NULL DEFAULT '[]'::jsonb,
  picked_ids      jsonb NOT NULL DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'answered', 'abandoned')),
  turn_index      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

-- ---------------------------------------------------------------------------
-- Migrate anything already stored in the unprefixed tables
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'conversations') THEN
    INSERT INTO agent_conversations (id, user_id, title, preview, created_at, updated_at)
      SELECT id, user_id, title, preview, created_at, updated_at FROM conversations
      ON CONFLICT (id) DO NOTHING;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'messages') THEN
    INSERT INTO agent_messages (id, conversation_id, role, content, interrupt_data, created_at)
      SELECT m.id, m.conversation_id, m.role, m.content, m.interrupt_data, m.created_at
      FROM messages m
      WHERE EXISTS (SELECT 1 FROM agent_conversations c WHERE c.id = m.conversation_id)
      ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
ALTER TABLE agent_conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_user_memory    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_selection_log  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_conversations_select ON agent_conversations;
CREATE POLICY agent_conversations_select ON agent_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_conversations_insert ON agent_conversations;
CREATE POLICY agent_conversations_insert ON agent_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_conversations_update ON agent_conversations;
CREATE POLICY agent_conversations_update ON agent_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_conversations_delete ON agent_conversations;
CREATE POLICY agent_conversations_delete ON agent_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_messages_select ON agent_messages;
CREATE POLICY agent_messages_select ON agent_messages FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM agent_conversations c
    WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS agent_messages_insert ON agent_messages;
CREATE POLICY agent_messages_insert ON agent_messages FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM agent_conversations c
    WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS agent_messages_update ON agent_messages;
CREATE POLICY agent_messages_update ON agent_messages FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM agent_conversations c
    WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM agent_conversations c
    WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS agent_messages_delete ON agent_messages;
CREATE POLICY agent_messages_delete ON agent_messages FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM agent_conversations c
    WHERE c.id = agent_messages.conversation_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS agent_user_memory_select ON agent_user_memory;
CREATE POLICY agent_user_memory_select ON agent_user_memory FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_user_memory_insert ON agent_user_memory;
CREATE POLICY agent_user_memory_insert ON agent_user_memory FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_user_memory_update ON agent_user_memory;
CREATE POLICY agent_user_memory_update ON agent_user_memory FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_user_memory_delete ON agent_user_memory;
CREATE POLICY agent_user_memory_delete ON agent_user_memory FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS agent_selection_log_select ON agent_selection_log;
CREATE POLICY agent_selection_log_select ON agent_selection_log FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM agent_conversations c
    WHERE c.id = agent_selection_log.conversation_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS agent_selection_log_insert ON agent_selection_log;
CREATE POLICY agent_selection_log_insert ON agent_selection_log FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM agent_conversations c
    WHERE c.id = agent_selection_log.conversation_id AND c.user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_updated
  ON agent_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation_created
  ON agent_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_agent_user_memory_user
  ON agent_user_memory (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_selection_log_unique
  ON agent_selection_log (conversation_id, selection_id);

-- ---------------------------------------------------------------------------
-- Keep updated_at honest
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION agent_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_conversations_touch ON agent_conversations;
CREATE TRIGGER trg_agent_conversations_touch
  BEFORE UPDATE ON agent_conversations
  FOR EACH ROW EXECUTE FUNCTION agent_touch_updated_at();
