from dataclasses import dataclass

from pydantic import BaseModel, EmailStr, field_validator


@dataclass
class History:
    action: str
    timestamp: str
    ok: bool
    error_message: str | None = None


class VerifyParams(BaseModel):
    confirmation_token: str
    confirm_code: str


class CreateLoginRecordParams(BaseModel):
    auth_email: EmailStr
    user_id: int

    @field_validator('auth_email', mode='after')
    @classmethod
    def normalize_email(cls, v):
        return v.lower()
