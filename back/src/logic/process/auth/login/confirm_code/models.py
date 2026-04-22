from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator

from logic.entity.user_auth_confirm_code.models import VerifyParams


class LoginStartParams(BaseModel):
    auth_email: EmailStr

    @field_validator('auth_email', mode='after')
    @classmethod
    def normalize_email(cls, v: str):
        return v.lower()


class LoginStartResult(BaseModel):
    confirmation_token: str
    expires_at: datetime


LoginFinishParams = VerifyParams


class LoginFinishResult(BaseModel):
    verified: bool
    message: str
    user_id: int
    person_id: int
    access_token: str
    expires_at: str
    session_expires_days: int
