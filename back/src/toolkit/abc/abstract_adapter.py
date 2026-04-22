from toolkit.abc.adapter import Adapter
from toolkit.abc.toolkit_metadata import ToolkitMetadata


class AbstractAdapter(ToolkitMetadata):
    _registry: list[type['AbstractAdapter']] = []

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if issubclass(cls, Adapter):
            return
        ToolkitMetadata._append_unique(cls, AbstractAdapter._registry)
