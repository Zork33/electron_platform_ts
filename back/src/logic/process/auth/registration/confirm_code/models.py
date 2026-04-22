from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator

from logic.entity.user_auth_confirm_code.models import VerifyParams


class RegistrationStartParams(BaseModel):
    auth_email: EmailStr
    first_name: str
    last_name: str | None = None
    middle_name: str | None = None

    @field_validator('auth_email', mode='after')
    @classmethod
    def normalize_email(cls, v: str):
        return v.lower()

    @field_validator('first_name', mode='before')
    @classmethod
    def strip_first_name(cls, v: str):
        return v.strip() if v else v

    @field_validator('last_name', 'middle_name', mode='before')
    @classmethod
    def strip_optional_strings(cls, v: str):
        return v.strip() if v else None


class RegistrationStartResult(BaseModel):
    confirmation_token: str
    expires_at: datetime


RegistrationFinishParams = VerifyParams


class RegistrationFinishResult(BaseModel):
    verified: bool
    message: str
    user_id: int
    person_id: int
    access_token: str
    expires_at: str
    session_expires_days: int
