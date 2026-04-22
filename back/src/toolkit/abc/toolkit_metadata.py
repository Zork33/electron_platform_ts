from abc import ABC


class ToolkitMetadata(ABC):
    _code: str
    _title: str
    _description: str | None = None

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if '_code' not in cls.__dict__:
            return
        code = cls._code
        if not code or not isinstance(code, str):
            raise TypeError(f"{cls.__qualname__} must define non-empty _code: str")
        title = getattr(cls, '_title', None)
        if not title or not isinstance(title, str):
            raise TypeError(f"{cls.__qualname__} must define non-empty _title: str")
        desc = cls._description
        if desc is not None and not isinstance(desc, str):
            raise TypeError(f"{cls.__qualname__} _description must be str or omitted")

    @staticmethod
    def _append_unique(cls: type, registry: list[type]) -> None:
        code = cls._code
        for existing in registry:
            if existing._code == code:
                raise TypeError(
                    f"Duplicate _code {code!r}: {existing.__qualname__} and {cls.__qualname__}"
                )
        registry.append(cls)
