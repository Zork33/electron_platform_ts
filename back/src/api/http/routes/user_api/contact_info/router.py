from fastapi import APIRouter

from api.http.factory.factory import Factory
from logic.entity.contact_info.entity import ContactInfo

router = Factory.create_logic_element_crud_router(
    logic_element_class=ContactInfo,
    prefix="",
    tags=["contact_info"]
)
