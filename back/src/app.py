from object_container.object_container import ObjectContainer
ObjectContainer.initialize()

from fastapi import FastAPI
from lifecycle.element import Lifecycle

lifecycle = Lifecycle("lifecycle")
lifespan = lifecycle.get_lifespan()

app = FastAPI(lifespan=lifespan)

lifecycle.after_start(app)
