from object_container.mixin import ObjectContainerMixin

from toolkit.abc.toolkit_metadata import ToolkitMetadata


_TOOLKIT_CONTAINER_INIT_MARK = "_toolkit_container_init_wrapped"


class ToolkitElement(ToolkitMetadata, ObjectContainerMixin):
    _container_ttl = -1
    _container_updatable = False
    _container_gettable = True

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)

        current_init = cls.__init__
        if getattr(current_init, _TOOLKIT_CONTAINER_INIT_MARK, False):
            # Уже обёрнут предком (Adapter / Tool); не дублируем container_id.
            return

        original_init = current_init

        def enhanced_init(self, container_id: str, *args, **kwargs):
            self._container_id = container_id
            self._container_category = self.__class__.__module__

            original_init(self, *args, **kwargs)

            self._add_to_container()

        setattr(enhanced_init, _TOOLKIT_CONTAINER_INIT_MARK, True)
        cls.__init__ = enhanced_init
