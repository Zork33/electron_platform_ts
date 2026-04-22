from fastapi import APIRouter

from api.http.factory.factory import Factory
from logic.entity.web_link.entity import WebLink

router = Factory.create_logic_element_crud_router(
    logic_element_class=WebLink,
    prefix="",
    tags=["web_link"]
)
