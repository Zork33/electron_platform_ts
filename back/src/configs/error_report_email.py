import os
from dataclasses import dataclass


@dataclass
class Config:
    recipient_email: str
    enabled: bool = True


def config() -> Config:
    recipient_email = os.environ.get("ERROR_REPORT_EMAIL_ADDRESS", "")
    enabled = os.environ.get("ERROR_EMAIL_REPORT_ENABLED", "True").lower() == "true"

    return Config(
        recipient_email=recipient_email,
        enabled=enabled and bool(recipient_email)
    )
