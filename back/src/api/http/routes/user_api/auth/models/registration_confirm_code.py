from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator


class RegistrationStartRequest(BaseModel):
    auth_email: EmailStr
    first_name: str
    last_name: str | None = None
    middle_name: str | None = None

    @field_validator('auth_email', mode='after')
    @classmethod
    def normalize_email(cls, v):
        return v.lower()

    @field_validator('first_name', mode='before')
    @classmethod
    def strip_first_name(cls, v):
        return v.strip() if v else v

    @field_validator('last_name', 'middle_name', mode='before')
    @classmethod
    def strip_optional_strings(cls, v):
        return v.strip() if v else None


class RegistrationStartResponse(BaseModel):
    confirmation_token: str
    expires_at: datetime


class RegistrationFinishRequest(BaseModel):
    confirmation_token: str
    confirm_code: str


class RegistrationFinishResponse(BaseModel):
    verified: bool
    message: str
    user_id: int
    person_id: int
    access_token: str
    expires_at: str
    session_expires_days: int
