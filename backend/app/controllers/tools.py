"""Tools router — plugin tools land in Milestone 2 (v1) and 5."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/tools", tags=["tools"])


@router.get("", status_code=501)
def list_tools() -> dict:  # pragma: no cover
    return {"detail": "not implemented until milestone 2"}
