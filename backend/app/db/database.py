import os
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings


def _ensure_sqlite_directory() -> None:
    """Create the SQLite parent directory when it is local and writable."""
    db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")
    if db_path.startswith("sqlite"):
        return

    target_dir = os.path.dirname(os.path.abspath(db_path))
    if not target_dir:
        return

    try:
        os.makedirs(target_dir, exist_ok=True)
    except OSError:
        # Local tests may import the app with container-centric paths like /app/data.
        # Engine creation can still succeed later when the URL is overridden.
        pass


_ensure_sqlite_directory()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False},  # sqlite only
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async DB session."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    """Create all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
