"""
Domain Configuration System

This module provides a flexible, config-driven approach to support multiple
document processing use cases:

- Insurance Claims Processing
- Home Loan / Mortgage Processing
- Trade Finance Document Analysis
- Small Business Lending

Each domain has its own:
1. Classification categories (document types to identify)
2. Extraction schema (fields to extract per document type)
3. Validation rules (business rules to apply)
4. Processing configuration (thresholds, required docs, etc.)
"""

from .domain_loader import (
    DomainConfig,
    load_domain_config,
    get_available_domains,
    get_current_domain,
    set_current_domain,
    get_domain_categories_path,
)

__all__ = [
    "DomainConfig",
    "load_domain_config",
    "get_available_domains",
    "get_current_domain",
    "set_current_domain",
    "get_domain_categories_path",
]
