from fastapi import APIRouter

from api.http.factory.factory import Factory
from logic.entity.email.entity import Email

router = Factory.create_logic_element_crud_router(
    logic_element_class=Email,
    prefix="",
    tags=["email"]
)
