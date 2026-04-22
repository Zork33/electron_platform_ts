from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator


class LoginStartRequest(BaseModel):
    auth_email: EmailStr

    @field_validator('auth_email', mode='after')
    @classmethod
    def normalize_email(cls, v):
        return v.lower()


class LoginStartResponse(BaseModel):
    confirmation_token: str
    expires_at: datetime


class LoginFinishRequest(BaseModel):
    confirmation_token: str
    confirm_code: str


class LoginFinishResponse(BaseModel):
    verified: bool
    message: str
    user_id: int
    person_id: int
    access_token: str
    expires_at: str
    session_expires_days: int
