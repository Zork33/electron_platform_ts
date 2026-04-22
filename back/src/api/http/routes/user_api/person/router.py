from fastapi import APIRouter
from pydantic import BaseModel

from api.http.factory.factory import Factory
from logic.entity.person.entity import Person

router = Factory.create_logic_element_crud_router(
    logic_element_class=Person,
    prefix="",
    tags=["person"]
)


class VectorSearchRequest(BaseModel):
    query: str
    limit: int = 10
    score_threshold: float | None = None


@router.post("/vector_search", tags=["person"])
async def vector_search(request: VectorSearchRequest):
    results = await Person.vector_search(request.query, request.limit, request.score_threshold)
    return [
        {**Factory.instance_to_api_dict(person), "score": round(score, 4)}
        for person, score in results
    ]
