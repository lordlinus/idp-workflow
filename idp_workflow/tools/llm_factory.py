"""LLM Provider Factory for DSPy.

Supports multiple LLM providers for DSPy-based extraction and classification:
- azure_openai: Azure OpenAI (default, uses existing env vars)
- openai: Direct OpenAI API
- openrouter: OpenRouter API (access to Qwen, DeepSeek, Llama, etc.)

Provider selection is driven by `options.llm_provider` in WorkflowInitInput,
with env-var defaults as fallback.
"""

import logging
import os
from typing import Any

import dspy

logger = logging.getLogger(__name__)

# Supported provider identifiers
PROVIDER_AZURE_OPENAI = "azure_openai"
PROVIDER_OPENAI = "openai"
PROVIDER_OPENROUTER = "openrouter"

SUPPORTED_PROVIDERS = {PROVIDER_AZURE_OPENAI, PROVIDER_OPENAI, PROVIDER_OPENROUTER}

# Well-known open-weight models available via OpenRouter
OPENROUTER_MODELS = {
    "qwen": "qwen/qwen-2.5-72b-instruct",
    "qwen3": "qwen/qwen3-235b-a22b",
    "deepseek": "deepseek/deepseek-chat-v3-0324",
    "deepseek-r1": "deepseek/deepseek-r1",
    "llama": "meta-llama/llama-3.3-70b-instruct",
}


def create_dspy_lm(options: dict[str, Any] | None = None) -> dspy.LM:
    """Create a configured dspy.LM instance based on provider settings.

    Provider resolution order:
    1. options["llm_provider"] (runtime override from workflow input)
    2. LLM_PROVIDER env var
    3. Default: "azure_openai"

    Args:
        options: Optional workflow options dict. Supported keys:
            - llm_provider: "azure_openai" | "openai" | "openrouter"
            - llm_model: Model name/deployment override
            - llm_temperature: Temperature override (default 0.0)
            - llm_api_key: Runtime API key override (not recommended)

    Returns:
        Configured dspy.LM instance
    """
    options = options or {}
    provider = options.get(
        "llm_provider", os.getenv("LLM_PROVIDER", PROVIDER_AZURE_OPENAI)
    )
    temperature = float(options.get("llm_temperature", 0.0))

    if provider not in SUPPORTED_PROVIDERS:
        logger.warning(
            f"Unknown LLM provider '{provider}', falling back to azure_openai"
        )
        provider = PROVIDER_AZURE_OPENAI

    if provider == PROVIDER_AZURE_OPENAI:
        return _create_azure_openai_lm(options, temperature)
    elif provider == PROVIDER_OPENAI:
        return _create_openai_lm(options, temperature)
    elif provider == PROVIDER_OPENROUTER:
        return _create_openrouter_lm(options, temperature)
    else:
        raise ValueError(f"Unsupported LLM provider: {provider}")


def _create_azure_openai_lm(options: dict[str, Any], temperature: float) -> dspy.LM:
    """Create Azure OpenAI dspy.LM."""
    from idp_workflow.config import (
        AZURE_OPENAI_CHAT_DEPLOYMENT_NAME,
        AZURE_OPENAI_ENDPOINT,
        AZURE_OPENAI_KEY,
        AZURE_OPENAI_API_VERSION,
    )

    model = options.get("llm_model", AZURE_OPENAI_CHAT_DEPLOYMENT_NAME)
    api_key = options.get("llm_api_key", AZURE_OPENAI_KEY)

    logger.info(f"Creating Azure OpenAI LM: azure/{model}")
    return dspy.LM(
        model=f"azure/{model}",
        api_base=AZURE_OPENAI_ENDPOINT,
        api_key=api_key,
        api_version=AZURE_OPENAI_API_VERSION,
        temperature=temperature,
    )


def _create_openai_lm(options: dict[str, Any], temperature: float) -> dspy.LM:
    """Create direct OpenAI dspy.LM."""
    model = options.get("llm_model", os.getenv("OPENAI_MODEL", "gpt-4.1"))
    api_key = options.get("llm_api_key", os.getenv("OPENAI_API_KEY", ""))

    if not api_key:
        raise ValueError("OPENAI_API_KEY is required for openai provider")

    logger.info(f"Creating OpenAI LM: openai/{model}")
    return dspy.LM(
        model=f"openai/{model}",
        api_key=api_key,
        temperature=temperature,
    )


def _create_openrouter_lm(options: dict[str, Any], temperature: float) -> dspy.LM:
    """Create OpenRouter dspy.LM (for Qwen, DeepSeek, Llama, etc.)."""
    raw_model = options.get("llm_model", os.getenv("OPENROUTER_MODEL", "qwen"))
    api_key = options.get("llm_api_key", os.getenv("OPENROUTER_API_KEY", ""))

    if not api_key:
        raise ValueError("OPENROUTER_API_KEY is required for openrouter provider")

    # Resolve shorthand model names to full OpenRouter paths
    model = OPENROUTER_MODELS.get(raw_model, raw_model)

    logger.info(f"Creating OpenRouter LM: openrouter/{model}")
    return dspy.LM(
        model=f"openrouter/{model}",
        api_key=api_key,
        api_base="https://openrouter.ai/api/v1",
        temperature=temperature,
    )


def get_available_providers() -> list[dict[str, Any]]:
    """Return metadata about available LLM providers for API responses."""
    return [
        {
            "id": PROVIDER_AZURE_OPENAI,
            "name": "Azure OpenAI",
            "description": "Azure-hosted OpenAI models (GPT-4.1, o3-mini)",
            "requires_env": ["AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_KEY"],
        },
        {
            "id": PROVIDER_OPENAI,
            "name": "OpenAI",
            "description": "Direct OpenAI API (GPT-4.1, GPT-4o)",
            "requires_env": ["OPENAI_API_KEY"],
        },
        {
            "id": PROVIDER_OPENROUTER,
            "name": "OpenRouter",
            "description": "Open-weight models via OpenRouter (Qwen, DeepSeek, Llama)",
            "requires_env": ["OPENROUTER_API_KEY"],
            "shorthand_models": OPENROUTER_MODELS,
        },
    ]
