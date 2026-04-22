from fastapi import APIRouter

from api.http.factory.factory import Factory
from logic.entity.phone_number.entity import PhoneNumber

router = Factory.create_logic_element_crud_router(
    logic_element_class=PhoneNumber,
    prefix="",
    tags=["phone_number"]
)
