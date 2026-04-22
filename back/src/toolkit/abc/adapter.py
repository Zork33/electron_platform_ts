from toolkit.abc.toolkit_element import ToolkitElement
from toolkit.abc.toolkit_metadata import ToolkitMetadata


class Adapter(ToolkitElement):
    _registry: list[type['Adapter']] = []

    def __init_subclass__(cls, **kwargs):
        original_init = cls.__dict__.get('__init__')

        super().__init_subclass__(**kwargs)

        if original_init is not None:
            cls._toolkit_original_init = original_init

        ToolkitMetadata._append_unique(cls, Adapter._registry)
