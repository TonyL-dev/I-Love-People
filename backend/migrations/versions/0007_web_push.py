"""Server-only device subscriptions and scheduled delivery receipts."""

from alembic import op

revision = "0007_web_push"
down_revision = "0006_in_app_nudges"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE ilp_private.push_devices (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            endpoint text,
            p256dh text,
            auth_secret text,
            endpoint_hash bytea UNIQUE,
            quiet_start integer NOT NULL CHECK (quiet_start BETWEEN 0 AND 1439),
            quiet_end integer NOT NULL CHECK (quiet_end BETWEEN 0 AND 1439),
            next_check timestamptz NOT NULL DEFAULT now(),
            CHECK (quiet_start <> quiet_end),
            CHECK (num_nonnulls(endpoint, p256dh, auth_secret) IN (0, 3)),
            CHECK (endpoint IS NULL OR endpoint_hash IS NOT NULL)
        );
        CREATE INDEX push_devices_owner ON ilp_private.push_devices(owner_id);
        CREATE INDEX push_devices_pending ON ilp_private.push_devices(next_check, id)
            WHERE endpoint IS NOT NULL;
        CREATE TABLE ilp_private.push_deliveries (
            device_id uuid NOT NULL REFERENCES ilp_private.push_devices(id) ON DELETE CASCADE,
            local_day date NOT NULL,
            attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 3),
            lease_token uuid NOT NULL,
            ready_after timestamptz NOT NULL,
            outcome text NOT NULL CHECK (outcome IN
                ('sending', 'retry', 'sent', 'revoked', 'failed')),
            PRIMARY KEY (device_id, local_day)
        );
        CREATE INDEX push_deliveries_retention ON ilp_private.push_deliveries(local_day);
        ALTER TABLE ilp_private.push_devices ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ilp_private.push_devices FORCE ROW LEVEL SECURITY;
        ALTER TABLE ilp_private.push_deliveries ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ilp_private.push_deliveries FORCE ROW LEVEL SECURITY;
        REVOKE ALL ON ilp_private.push_devices, ilp_private.push_deliveries
            FROM PUBLIC, anon, authenticated, service_role;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE ilp_private.push_deliveries, ilp_private.push_devices")
