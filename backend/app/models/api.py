"""Single response envelope shared by every JSON endpoint."""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiErrorBody(BaseModel):
    code: str
    message: str


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: T | None = None
    error: ApiErrorBody | None = None


def ok(data: T) -> ApiResponse[T]:
    return ApiResponse(success=True, data=data)
