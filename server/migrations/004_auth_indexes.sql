CREATE INDEX IF NOT EXISTS admin_sessions_user_id_idx ON admin_sessions (user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_cleanup_idx ON admin_sessions (expires_at, revoked_at);
CREATE INDEX IF NOT EXISTS admin_users_status_idx ON admin_users (status);
