from jsonschema import validate, ValidationError as JSONSchemaValidationError
from fastapi import HTTPException
from typing import Dict, Any

def validate_params_against_schema(params: Dict[str, Any], schema: Dict[str, Any]) -> None:
    """
    Validate runtime parameters against a JSON Schema.
    
    Args:
        params: The parameter dictionary to validate
        schema: The JSON Schema definition
        
    Raises:
        HTTPException: If validation fails
    """
    try:
        validate(instance=params, schema=schema)
    except JSONSchemaValidationError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Parameter validation failed: {e.message}"
        )
