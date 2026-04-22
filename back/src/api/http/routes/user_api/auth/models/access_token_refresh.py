from datetime import datetime
from pydantic import BaseModel


class AccessTokenRefreshResponse(BaseModel):
    access_token: str
    expires_at: datetime
