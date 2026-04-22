from toolkit.abc.tool import Tool
from toolkit.abc.toolkit_metadata import ToolkitMetadata


class AbstractTool(ToolkitMetadata):
    _registry: list[type['AbstractTool']] = []

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if issubclass(cls, Tool):
            return
        ToolkitMetadata._append_unique(cls, AbstractTool._registry)
