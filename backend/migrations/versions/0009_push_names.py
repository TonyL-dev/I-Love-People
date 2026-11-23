"""Keep notification name disclosure opt-in on each device."""

from alembic import op

revision = "0009_push_names"
down_revision = "0008_portable_backups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE ilp_private.push_devices
            ADD COLUMN show_name boolean NOT NULL DEFAULT false
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE ilp_private.push_devices DROP COLUMN show_name")
