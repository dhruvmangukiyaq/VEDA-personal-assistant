"""Memory router — persistent memory lands in Milestone 4 (SQLite)."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/memory", tags=["memory"])


@router.get("", status_code=501)
def list_memory() -> dict:  # pragma: no cover
    return {"detail": "not implemented until milestone 4"}


@router.delete("", status_code=501)
def delete_memory() -> dict:  # pragma: no cover
    return {"detail": "not implemented until milestone 4"}
