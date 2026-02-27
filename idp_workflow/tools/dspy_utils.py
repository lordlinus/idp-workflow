"""DSPy utilities for document extraction.

This module consolidates all DSPy-related utilities:
- Dynamic schema generation from analyzer templates
- Field presence scoring
- DSPy signature creation

NOTE: DSPy doesn't provide native confidence scores. The presence scores
indicate whether a field was populated, not extraction accuracy.
"""

import json
from pathlib import Path
from typing import Any, Optional

import dspy
from pydantic import BaseModel, Field, create_model


# =============================================================================
# Field Presence Scoring
# =============================================================================


def calculate_presence_scores(extracted_data: BaseModel) -> dict[str, float]:
    """Calculate field presence scores (NOT confidence scores).

    Returns:
        Dict mapping field names to presence scores:
        - 1.0: Field has a non-empty value
        - 0.0: Field is empty/default

    Note: These are NOT confidence scores. DSPy doesn't provide confidence.
    For actual extraction quality, compare Azure vs DSPy results.
    """
    scores: dict[str, float] = {}
    for field_name, field_value in extracted_data.model_dump().items():
        if isinstance(field_value, str):
            scores[field_name] = 1.0 if field_value.strip() else 0.0
        elif isinstance(field_value, (int, float)):
            scores[field_name] = 1.0 if field_value != 0 else 0.0
        elif isinstance(field_value, list):
            scores[field_name] = 1.0 if field_value else 0.0
        elif field_value is None:
            scores[field_name] = 0.0
        else:
            scores[field_name] = 1.0  # Has some value
    return scores


# Backward compatibility alias
calculate_confidence_scores = calculate_presence_scores


# =============================================================================
# Dynamic Schema Generation
# =============================================================================


def _get_python_type(field_type: str) -> type:
    """Map JSON schema types to Python types."""
    type_mapping = {
        "string": str,
        "number": float,
        "date": str,
        "integer": int,
        "boolean": bool,
    }
    return type_mapping.get(field_type, str)


def _get_default_value(field_type: str) -> Any:
    """Get default value for a field type."""
    default_mapping = {
        "string": "",
        "number": 0.0,
        "date": "",
        "integer": 0,
        "boolean": False,
    }
    return default_mapping.get(field_type, None)


def _create_nested_model(
    field_name: str,
    field_schema: dict[str, Any],
    created_models: dict[str, type[BaseModel]],
) -> type[BaseModel]:
    """Create a nested Pydantic model for object-type fields."""
    model_name = f"{field_name.title().replace('_', '')}Model"
    if model_name in created_models:
        return created_models[model_name]

    properties = field_schema.get("properties", {})
    field_definitions: dict[str, tuple[type | Any, Field]] = {}  # type: ignore

    for prop_name, prop_schema in properties.items():
        prop_type = prop_schema.get("type", "string")
        prop_desc = prop_schema.get("description", "")

        if prop_type == "array":
            items_schema = prop_schema.get("items", {})
            item_type = items_schema.get("type", "string")
            if item_type == "object":
                nested_model = _create_nested_model(
                    f"{prop_name}_item", items_schema, created_models
                )
                field_definitions[prop_name] = (
                    list[nested_model],
                    Field(default_factory=list, description=prop_desc),
                )
            else:
                item_python_type = _get_python_type(item_type)
                field_definitions[prop_name] = (
                    list[item_python_type],
                    Field(default_factory=list, description=prop_desc),
                )
        elif prop_type == "object":
            nested_model = _create_nested_model(prop_name, prop_schema, created_models)
            field_definitions[prop_name] = (
                Optional[nested_model],
                Field(default=None, description=prop_desc),
            )
        else:
            python_type = _get_python_type(prop_type)
            default_val = _get_default_value(prop_type)
            field_definitions[prop_name] = (
                python_type,
                Field(default=default_val, description=prop_desc),
            )

    model = create_model(model_name, **field_definitions)  # type: ignore
    created_models[model_name] = model
    return model


def create_extraction_model_from_schema(schema_path: str | Path) -> type[BaseModel]:
    """Dynamically create a Pydantic model from an extraction schema file.

    Args:
        schema_path: Path to JSON schema file (e.g., extraction_schema.json)

    Returns:
        A dynamically generated Pydantic model class
    """
    with open(schema_path, "r") as f:
        schema = json.load(f)

    return create_extraction_model_from_dict(schema)


def create_extraction_model_from_dict(schema: dict[str, Any]) -> type[BaseModel]:
    """Dynamically create a Pydantic model from an extraction schema dict.

    Args:
        schema: Schema dict containing fieldSchema.fields

    Returns:
        A dynamically generated Pydantic model class

    Raises:
        ValueError: If schema is invalid
    """
    fields_schema = schema.get("fieldSchema", {}).get("fields", {})
    if not fields_schema:
        raise ValueError(
            "Schema must contain 'fieldSchema.fields' with at least one field definition"
        )

    created_models: dict[str, type[BaseModel]] = {}
    field_definitions: dict[str, tuple[type | Any, Field]] = {}  # type: ignore

    for field_name, field_schema in fields_schema.items():
        field_type = field_schema.get("type", "string")
        field_desc = field_schema.get("description", "")

        if field_type == "array":
            items_schema = field_schema.get("items", {})
            item_type = items_schema.get("type", "string")
            if item_type == "object":
                nested_model = _create_nested_model(
                    field_name, items_schema, created_models
                )
                field_definitions[field_name] = (
                    list[nested_model],
                    Field(default_factory=list, description=field_desc),
                )
            else:
                item_python_type = _get_python_type(item_type)
                field_definitions[field_name] = (
                    list[item_python_type],
                    Field(default_factory=list, description=field_desc),
                )
        elif field_type == "object":
            nested_model = _create_nested_model(
                field_name, field_schema, created_models
            )
            field_definitions[field_name] = (
                Optional[nested_model],
                Field(default=None, description=field_desc),
            )
        else:
            python_type = _get_python_type(field_type)
            default_val = _get_default_value(field_type)
            field_definitions[field_name] = (
                python_type,
                Field(default=default_val, description=field_desc),
            )

    return create_model(
        "DynamicExtractionModel",
        __model_doc__="Generated from extraction schema",
        **field_definitions,  # type: ignore[call-overload]
    )


# =============================================================================
# DSPy Signature Creation
# =============================================================================


def create_extraction_signature(
    extraction_model: type[BaseModel],
) -> type[dspy.Signature]:
    """Create a DSPy signature for document extraction.

    Uses the modern DSPy pattern with typed Pydantic output fields.
    Based on: https://cocoindex.io/blogs/extraction-dspy

    Args:
        extraction_model: Pydantic model defining the extraction fields

    Returns:
        A DSPy Signature class for the extraction task
    """
    # Create signature class with proper typed annotations
    # Following the pattern from DSPy docs and cocoindex examples
    signature_fields = {
        "__doc__": """Extract structured data from document text.
        
        Carefully read the document text and extract all relevant fields
        according to the output schema. For fields not found in the document,
        use empty strings for text fields and 0 for numeric fields.
        """,
        "__annotations__": {
            "document_text": str,
            "extracted_data": extraction_model,
        },
        "document_text": dspy.InputField(
            desc="Full document text content to extract data from"
        ),
        "extracted_data": dspy.OutputField(
            desc="Structured extracted data matching the schema"
        ),
    }

    return type("DocumentExtractionSignature", (dspy.Signature,), signature_fields)


# =============================================================================
# Schema Validation
# =============================================================================

VALID_FIELD_TYPES = {
    "string",
    "number",
    "date",
    "integer",
    "boolean",
    "array",
    "object",
}


def validate_extraction_schema(schema: dict[str, Any]) -> list[str]:
    """Validate an extraction schema dict and return a list of errors.

    Args:
        schema: Schema dict to validate

    Returns:
        Empty list if valid, otherwise list of error messages
    """
    errors: list[str] = []

    if not isinstance(schema, dict):
        return ["Schema must be a JSON object"]

    field_schema = schema.get("fieldSchema")
    if not isinstance(field_schema, dict):
        errors.append("Schema must contain 'fieldSchema' object")
        return errors

    fields = field_schema.get("fields")
    if not isinstance(fields, dict) or not fields:
        errors.append("'fieldSchema.fields' must be a non-empty object")
        return errors

    for field_name, field_def in fields.items():
        if not isinstance(field_def, dict):
            errors.append(f"Field '{field_name}' must be an object")
            continue

        field_type = field_def.get("type", "string")
        if field_type not in VALID_FIELD_TYPES:
            errors.append(
                f"Field '{field_name}' has invalid type '{field_type}'. "
                f"Valid types: {', '.join(sorted(VALID_FIELD_TYPES))}"
            )

        if field_type == "array":
            items = field_def.get("items")
            if not isinstance(items, dict):
                errors.append(
                    f"Array field '{field_name}' must have an 'items' definition"
                )

        if field_type == "object":
            props = field_def.get("properties")
            if not isinstance(props, dict):
                errors.append(
                    f"Object field '{field_name}' must have a 'properties' definition"
                )

    # Attempt to create the Pydantic model as final validation
    if not errors:
        try:
            create_extraction_model_from_dict(schema)
        except Exception as e:
            errors.append(f"Schema produces invalid model: {e}")

    return errors
