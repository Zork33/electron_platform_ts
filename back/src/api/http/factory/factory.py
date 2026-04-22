import json

from pydantic import BaseModel, create_model
from fastapi import APIRouter, HTTPException, Query

from data_framework.crud_element import CrudElement
from data_framework.file_descriptor.descriptor import FileDescriptor


class Factory:
    @staticmethod
    def get_api_fields(
        source_class: type,
        exclude: set[str] | None = None,
        include: set[str] | None = None,
        include_private: bool = False,
        for_list: bool = False
    ) -> dict[str, type]:
        if not hasattr(source_class, '__annotations__'):
            return {}
        
        annotations = {}
        for cls in source_class.__mro__:
            if cls is object:
                continue
            class_annotations = getattr(cls, "__annotations__", {})
            annotations.update(class_annotations)
        
        result = {}
        for field_name, field_type in annotations.items():
            if not include_private and field_name.startswith("_"):
                continue
            if exclude and field_name in exclude:
                continue
            if include and field_name not in include:
                continue
            result[field_name] = field_type

        file_fields = getattr(source_class, "_file_fields", [])
        for descriptor in file_fields:
            if not isinstance(descriptor, FileDescriptor):
                continue
            include_flag = descriptor.include_in_get_list if for_list else descriptor.include_in_get
            if not include_flag:
                continue
            if not descriptor.attr_name:
                continue

            field_name = descriptor.attr_name
            if not include_private and field_name.startswith("_"):
                continue
            if exclude and field_name in exclude:
                continue
            if include and field_name not in include:
                continue

            if field_name in result:
                continue

            if descriptor.is_file:
                result[field_name] = dict | None
            elif descriptor.is_collection:
                result[field_name] = list[dict]
        
        return result
    
    @staticmethod
    def instance_to_api_dict(
        instance,
        fields: dict[str, type] | None = None
    ) -> dict:
        if fields is None:
            fields = Factory.get_api_fields(instance.__class__)

        result = {}
        for field_name in fields:
            if not hasattr(instance, field_name):
                continue
            value = getattr(instance, field_name)
            if isinstance(value, FileDescriptor):
                result[field_name] = None
            else:
                result[field_name] = value
        return result
    
    @staticmethod
    def batch_to_api_dict(
        instances: list,
        fields: dict[str, type] | None = None,
        for_list: bool = True
    ) -> list[dict]:
        if not instances:
            return []
        
        if fields is None:
            fields = Factory.get_api_fields(instances[0].__class__, for_list=for_list)
        
        return [Factory.instance_to_api_dict(instance, fields) for instance in instances]
    
    @staticmethod
    def class_to_pydantic(
        source_class: type,
        model_name: str,
        fields: dict[str, type] | None = None
    ) -> type[BaseModel]:
        if fields is None:
            fields = Factory.get_api_fields(source_class)
        
        if not fields:
            raise ValueError(f"Class {source_class.__name__} has no annotations")
        
        field_definitions = {}
        for field_name, field_type in fields.items():
            default_value = getattr(source_class, field_name, ...)
            if default_value is ...:
                field_definitions[field_name] = (field_type, ...)
            else:
                field_definitions[field_name] = (field_type, default_value)
        
        return create_model(model_name, **field_definitions)
    
    @staticmethod
    def create_logic_element_crud_router(
        logic_element_class: type[CrudElement],
        prefix: str,
        tags: list[str] | None = None,
        include_operations: set[str] | None = None
    ) -> APIRouter:
        router = APIRouter(prefix=prefix, tags=tags or [])
        
        operations = include_operations or {'create', 'read', 'update', 'delete', 'list'}
        
        if 'list' in operations:
            @router.get("", response_model=list)
            async def list_items(
                limit: int = Query(100, ge=1, le=1000, description="Number of items to return"),
                offset: int = Query(0, ge=0, description="Number of items to skip"),
                order_by: str | None = Query(None, description="Field name to sort by"),
                order_direction: str = Query("asc", description="Sort direction: 'asc' or 'desc'"),
                include_deleted: bool = Query(
                    False,
                    description="If true, include soft-deleted rows (deleted_at IS NOT NULL)",
                ),
                filters: str | None = Query(
                    None,
                    description="""JSON array of filter objects with logical operators.
                    
Example: [{"field": "price", "operator": ">=", "value": 100}, "AND", {"field": "category", "operator": "=", "value": "electronics"}]

Supported operators: =, >, <, >=, <=, !=, <>, LIKE, ILIKE, IN, NOT IN, IS, IS NOT

Filter object structure:
- field: string - field name to filter
- operator: string - comparison operator
- value: any - value to compare against

Logical operators: AND, OR (as strings between filter objects)"""
                )
            ):
                if order_direction not in ("asc", "desc"):
                    raise HTTPException(status_code=400, detail="Order direction must be 'asc' or 'desc'")
                
                parsed_filters = None
                if filters:
                    try:
                        parsed_filters = json.loads(filters)
                        if not isinstance(parsed_filters, list):
                            raise HTTPException(
                                status_code=400,
                                detail="Filters must be a JSON array"
                            )
                    except json.JSONDecodeError as e:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid JSON format in filters: {str(e)}"
                        )
                
                page_number = (offset // limit) + 1 if limit > 0 else 1
                page_count = limit
                
                kwargs = {
                    "page_count": page_count,
                    "page_number": page_number,
                    "include_deleted": include_deleted,
                }
                
                if order_by:
                    kwargs["orderby"] = {
                        "field": [order_by],
                        "direction": order_direction
                    }
                
                if parsed_filters:
                    kwargs["filters"] = parsed_filters
                
                items = await logic_element_class.get_list(**kwargs)
                return Factory.batch_to_api_dict(items)
        
        if 'read' in operations:
            @router.get("/{item_id:int}")
            async def get_item(item_id: int):
                item = await logic_element_class.get(item_id)
                if not item:
                    raise HTTPException(status_code=404, detail="Item not found")
                return Factory.instance_to_api_dict(item)
        
        if 'create' in operations:
            @router.post("")
            async def create_item(data: dict):
                item = await logic_element_class.create(data)
                return Factory.instance_to_api_dict(item)
        
        if 'update' in operations:
            @router.put("/{item_id:int}")
            async def update_item(item_id: int, data: dict):
                item = await logic_element_class.update(item_id, data)
                if not item:
                    raise HTTPException(status_code=404, detail="Item not found")
                return Factory.instance_to_api_dict(item)
        
        if 'delete' in operations:
            @router.delete("/{item_id:int}")
            async def delete_item(item_id: int):
                deleted_item = await logic_element_class.delete(item_id)
                if not deleted_item:
                    raise HTTPException(status_code=404, detail="Item not found")
                return Factory.instance_to_api_dict(deleted_item)
        
        return router
