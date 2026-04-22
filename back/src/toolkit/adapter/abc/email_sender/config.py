from pydantic import Field

from toolkit.abc.config import Config


class SmtpConnectionConfig(Config):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    from_email: str = Field(min_length=1)
    from_name: str | None = None
    server: str = Field(default="localhost", min_length=1)
    port: int = Field(default=587, ge=1, le=65535)
    starttls: bool = True
    ssl_tls: bool = False
    use_credentials: bool = True
    validate_certs: bool = True
