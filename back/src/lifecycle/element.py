from contextlib import asynccontextmanager

from lifecycle.abc.lifecycle_element import LifecycleElement
from .handlers.object_container_cleanup import start_object_container_cleanup, stop_object_container_cleanup
from .handlers.env_manager import create_env_manager, load_env
from .handlers.db import connect_db, disconnect_db
from .handlers.email_sender import create_email_sender
from .handlers.user_auth_jwt_manager import create_user_auth_jwt_manager
from .handlers.http_server import http_web_server
from .handlers.ws_server import ws_server
from .handlers.file_storage import connect_file_storage, sync_file_storage_parts
from .handlers.file_manager import create_file_manager
from .handlers.image_cropper import create_image_cropper
from .handlers.web_socket import create_web_socket, stop_web_socket


class Lifecycle(LifecycleElement):
    def get_lifespan(self):
        @asynccontextmanager
        async def lifespan(app):
            await self.startup()
            yield
            await self.shutdown()
        return lifespan
    
    async def startup(self):
        await start_object_container_cleanup()
        create_env_manager()
        load_env()
        await connect_db()
        await connect_file_storage()
        await sync_file_storage_parts()
        create_file_manager()
        create_image_cropper()
        create_email_sender()
        create_user_auth_jwt_manager()
        await create_web_socket()
    
    def after_start(self, app):
        http_web_server(app)
        ws_server(app)

    async def shutdown(self):
        await stop_web_socket()
        await disconnect_db()
        await stop_object_container_cleanup()
