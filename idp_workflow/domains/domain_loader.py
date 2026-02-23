"""
Domain Configuration Loader

Dynamically loads domain-specific configurations for document processing.
This enables the same workflow to handle different industry verticals.

Uses Pydantic models with validation and LRU caching for performance.
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from pydantic import BaseModel, Field

# Current active domain (defaults to insurance)
_current_domain: str = "insurance_claims"

# Domain configurations directory
DOMAINS_DIR = Path(__file__).parent


# ============================================================================
# Pydantic Models (validated, cached)
# ============================================================================


class ValidationRule(BaseModel):
    """A validation rule to apply during processing."""

    name: str
    description: str
    rule_type: str = Field(
        default="required_field",
        description="Type: required_field, cross_field, threshold, external_check",
    )
    parameters: dict[str, Any] = Field(default_factory=dict)
    severity: str = Field(default="warning")


class DocumentTypeConfig(BaseModel):
    """Configuration for a specific document type within a domain."""

    name: str
    description: str = ""
    pattern_keywords: list[str] = Field(default_factory=list)
    required: bool = False
    extraction_priority: int = Field(default=1, ge=0)


class DomainConfig(BaseModel):
    """Complete configuration for a document processing domain."""

    # Metadata
    domain_id: str
    display_name: str
    description: str
    icon: str = "📄"

    # Document classification
    document_types: list[DocumentTypeConfig] = Field(default_factory=list)

    # Extraction schema (maps to analyzer_template.json format)
    extraction_schema: dict[str, Any] = Field(default_factory=dict)

    # Validation rules
    validation_rules: list[ValidationRule] = Field(default_factory=list)

    # Processing configuration
    stp_confidence_threshold: float = Field(default=0.85, ge=0.0, le=1.0)
    require_human_review_categories: list[str] = Field(default_factory=list)
    max_processing_pages: int = Field(default=50, ge=1)

    # Domain-specific settings
    settings: dict[str, Any] = Field(default_factory=dict)

    def get_classification_categories(self) -> list[dict[str, Any]]:
        """Get categories in the format expected by the classifier."""
        return [
            {
                "name": doc_type.name,
                "description/Note": doc_type.description,
                "pattern_keywords": doc_type.pattern_keywords,
            }
            for doc_type in self.document_types
        ]

    def get_extraction_document_types(self) -> list[str]:
        """Get document types that require field extraction."""
        return [
            doc_type.name
            for doc_type in self.document_types
            if doc_type.extraction_priority > 0
        ]

    def get_required_documents(self) -> list[str]:
        """Get list of required document types for a complete submission."""
        return [doc_type.name for doc_type in self.document_types if doc_type.required]


# ============================================================================
# Cached Loader
# ============================================================================


@lru_cache(maxsize=16)
def _load_domain_config_cached(domain_id: str) -> DomainConfig:
    """Internal cached loader - returns validated Pydantic model."""
    domain_dir = DOMAINS_DIR / domain_id

    if not domain_dir.exists():
        raise FileNotFoundError(f"Domain configuration not found: {domain_id}")

    # Load main config
    config_path = domain_dir / "config.json"
    with open(config_path, "r") as f:
        config_data = json.load(f)

    # Load classification categories
    categories_path = domain_dir / "classification_categories.json"
    with open(categories_path, "r") as f:
        categories_data = json.load(f)

    # Load extraction schema
    schema_path = domain_dir / "extraction_schema.json"
    with open(schema_path, "r") as f:
        extraction_schema = json.load(f)

    # Load validation rules (optional)
    validation_rules: list[ValidationRule] = []
    rules_path = domain_dir / "validation_rules.json"
    if rules_path.exists():
        with open(rules_path, "r") as f:
            rules_data = json.load(f)
            validation_rules = [
                ValidationRule.model_validate(rule) for rule in rules_data
            ]

    # Build document types with Pydantic validation
    document_types = [
        DocumentTypeConfig(
            name=cat["name"],
            description=cat.get("description/Note", cat.get("description", "")),
            pattern_keywords=cat.get("pattern_keywords", []),
            required=cat.get("required", False),
            extraction_priority=cat.get("extraction_priority", 1),
        )
        for cat in categories_data
    ]

    return DomainConfig(
        domain_id=domain_id,
        display_name=config_data["display_name"],
        description=config_data["description"],
        icon=config_data.get("icon", "📄"),
        document_types=document_types,
        extraction_schema=extraction_schema,
        validation_rules=validation_rules,
        stp_confidence_threshold=config_data.get("stp_confidence_threshold", 0.85),
        require_human_review_categories=config_data.get(
            "require_human_review_categories", []
        ),
        max_processing_pages=config_data.get("max_processing_pages", 50),
        settings=config_data.get("settings", {}),
    )


def load_domain_config(domain_id: str) -> DomainConfig:
    """Load a domain configuration from JSON files.

    Args:
        domain_id: The domain identifier (e.g., "insurance_claims", "home_loan")

    Returns:
        DomainConfig with all settings loaded and validated

    Raises:
        FileNotFoundError: If domain configuration doesn't exist
        ValidationError: If config fails Pydantic validation
    """
    return _load_domain_config_cached(domain_id)


def clear_domain_cache() -> None:
    """Clear the domain config cache (e.g., after config update)."""
    _load_domain_config_cached.cache_clear()
    _get_available_domains_cached.cache_clear()


@lru_cache(maxsize=1)
def _get_available_domains_cached() -> tuple[dict[str, str], ...]:
    """Internal cached domain list loader."""
    domains = []

    for domain_dir in DOMAINS_DIR.iterdir():
        if domain_dir.is_dir() and (domain_dir / "config.json").exists():
            config_path = domain_dir / "config.json"
            with open(config_path, "r") as f:
                config_data = json.load(f)

            domains.append(
                {
                    "id": domain_dir.name,
                    "name": config_data["display_name"],
                    "description": config_data["description"],
                    "icon": config_data.get("icon", "📄"),
                }
            )

    return tuple(sorted(domains, key=lambda x: x["name"]))


def get_available_domains() -> list[dict[str, str]]:
    """Get list of available domain configurations.

    Returns:
        List of dicts with id, name, description, icon
    """
    return list(_get_available_domains_cached())


def get_current_domain() -> str:
    """Get the currently active domain ID."""
    global _current_domain
    return _current_domain


def set_current_domain(domain_id: str) -> DomainConfig:
    """Set the active domain and return its configuration.

    Args:
        domain_id: The domain to activate

    Returns:
        The loaded DomainConfig

    Raises:
        FileNotFoundError: If domain doesn't exist
    """
    global _current_domain

    # Validate domain exists by loading it
    config = load_domain_config(domain_id)
    _current_domain = domain_id

    return config


def get_domain_categories_path(domain_id: Optional[str] = None) -> Path:
    """Get the path to classification categories for a domain.

    Args:
        domain_id: Domain to get path for, or None for current domain

    Returns:
        Path to the classification_categories.json file
    """
    if domain_id is None:
        domain_id = get_current_domain()

    return DOMAINS_DIR / domain_id / "classification_categories.json"


def get_domain_schema_path(domain_id: Optional[str] = None) -> Path:
    """Get the path to extraction schema for a domain.

    Args:
        domain_id: Domain to get path for, or None for current domain

    Returns:
        Path to the extraction_schema.json file
    """
    if domain_id is None:
        domain_id = get_current_domain()

    return DOMAINS_DIR / domain_id / "extraction_schema.json"
