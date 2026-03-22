CREATE TABLE IF NOT EXISTS client_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_feedback_user_created_at
  ON client_feedback(user_id, created_at DESC);

ALTER TABLE client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own client_feedback"
  ON client_feedback FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM app_allowed_users
      WHERE lower(app_allowed_users.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        AND app_allowed_users.role = 'admin'
    )
  );

CREATE POLICY "Users insert own client_feedback"
  ON client_feedback FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM app_allowed_users
      WHERE lower(app_allowed_users.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
        AND app_allowed_users.role = 'admin'
    )
  );
