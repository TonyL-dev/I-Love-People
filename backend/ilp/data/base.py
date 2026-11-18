from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Application metadata only. Supabase owns Auth's schema and migrations."""
