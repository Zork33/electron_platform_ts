from object_container.object_container import ObjectContainer

def _get_container():
    return ObjectContainer.get_instance()

async def start_object_container_cleanup():
    container = _get_container()
    await container.cleaner.start(5)


async def stop_object_container_cleanup():
    container = _get_container()
    await container.cleaner.stop()
