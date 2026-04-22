from fastapi import APIRouter

from api.http.factory.factory import Factory
from logic.entity.tg_acc.entity import TgAcc

router = Factory.create_logic_element_crud_router(
    logic_element_class=TgAcc,
    prefix="",
    tags=["tg_acc"]
)
