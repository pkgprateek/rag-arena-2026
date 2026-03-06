"""Database setup for SQLAlchemy + aiosqlite."""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

from app.config import settings

# In case the directory doesn't exist (e.g., local testing), create it.
db_path = settings.database_url.replace("sqlite+aiosqlite:///", "")
if db_path.startswith("/app/data"):
    os.makedirs("/app/data", exist_ok=True)
elif not db_path.startswith("sqlite"):
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)

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
