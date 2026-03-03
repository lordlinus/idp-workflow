"""LLM Provider Factory for DSPy.

Supports multiple LLM providers for DSPy-based extraction and classification:
- azure_openai: Azure OpenAI (default, uses existing env vars)
- claude: Anthropic Claude API
- azure_ai_models: Azure AI Model Catalog / Azure AI Foundry serverless endpoints
  for open-weight models (Qwen, DeepSeek, Llama, Phi, etc.)

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
PROVIDER_CLAUDE = "claude"
PROVIDER_AZURE_AI_MODELS = "azure_ai_models"

SUPPORTED_PROVIDERS = {PROVIDER_AZURE_OPENAI, PROVIDER_CLAUDE, PROVIDER_AZURE_AI_MODELS}

# Open-weight models available via Azure AI Model Catalog (serverless endpoints).
# Deploy these from Azure AI Foundry → Model Catalog → Serverless API.
# The shorthand maps to the catalog deployment name used by the
# Azure AI Model Inference API (OpenAI-compatible).
AZURE_AI_CATALOG_MODELS = {
    "qwen": "Qwen2.5-72B-Instruct",
    "qwen3": "Qwen3-235B-A22B",
    "deepseek": "DeepSeek-V3",
    "deepseek-r1": "DeepSeek-R1",
    "llama": "Meta-Llama-3.3-70B-Instruct",
    "phi": "Phi-4",
}


def create_dspy_lm(options: dict[str, Any] | None = None) -> dspy.LM:
    """Create a configured dspy.LM instance based on provider settings.

    Provider resolution order:
    1. options["llm_provider"] (runtime override from workflow input)
    2. LLM_PROVIDER env var
    3. Default: "azure_openai"

    Args:
        options: Optional workflow options dict. Supported keys:
            - llm_provider: "azure_openai" | "claude" | "azure_ai_models"
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
    elif provider == PROVIDER_CLAUDE:
        return _create_claude_lm(options, temperature)
    elif provider == PROVIDER_AZURE_AI_MODELS:
        return _create_azure_ai_models_lm(options, temperature)
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


def _create_claude_lm(options: dict[str, Any], temperature: float) -> dspy.LM:
    """Create Anthropic Claude dspy.LM."""
    model = options.get("llm_model", os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"))
    api_key = options.get("llm_api_key", os.getenv("ANTHROPIC_API_KEY", ""))

    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is required for claude provider")

    logger.info(f"Creating Claude LM: anthropic/{model}")
    return dspy.LM(
        model=f"anthropic/{model}",
        api_key=api_key,
        temperature=temperature,
    )


def _create_azure_ai_models_lm(options: dict[str, Any], temperature: float) -> dspy.LM:
    """Create Azure AI Model Catalog dspy.LM (for open-weight models on Azure).

    Uses Azure AI Foundry serverless endpoints which expose an OpenAI-compatible
    chat completions API. Deploy models from the Azure AI Model Catalog
    (Qwen, DeepSeek, Llama, Phi, etc.) as serverless APIs, then point
    AZURE_AI_MODELS_ENDPOINT to the endpoint URL.

    For individual serverless (MaaS) deployments each model gets its own
    endpoint and key. For the unified Azure AI Model Inference endpoint
    (https://<project>.services.ai.azure.com/models) a single endpoint
    serves multiple models and you select by model name.
    """
    raw_model = options.get("llm_model", os.getenv("AZURE_AI_MODELS_MODEL", "qwen"))
    api_key = options.get("llm_api_key", os.getenv("AZURE_AI_MODELS_KEY", ""))
    api_base = os.getenv("AZURE_AI_MODELS_ENDPOINT", "")

    if not api_key:
        raise ValueError("AZURE_AI_MODELS_KEY is required for azure_ai_models provider")
    if not api_base:
        raise ValueError("AZURE_AI_MODELS_ENDPOINT is required for azure_ai_models provider")

    # Resolve shorthand model names to Azure AI Catalog deployment names
    model = AZURE_AI_CATALOG_MODELS.get(raw_model, raw_model)

    logger.info(f"Creating Azure AI Models LM: openai/{model} via {api_base}")
    return dspy.LM(
        model=f"openai/{model}",
        api_key=api_key,
        api_base=api_base,
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
            "id": PROVIDER_CLAUDE,
            "name": "Claude",
            "description": "Anthropic Claude models (Claude Sonnet, Claude Opus)",
            "requires_env": ["ANTHROPIC_API_KEY"],
        },
        {
            "id": PROVIDER_AZURE_AI_MODELS,
            "name": "Azure AI Models",
            "description": "Open-weight models on Azure (Qwen, DeepSeek, Llama, Phi) via Azure AI Foundry serverless endpoints",
            "requires_env": ["AZURE_AI_MODELS_ENDPOINT", "AZURE_AI_MODELS_KEY"],
            "shorthand_models": AZURE_AI_CATALOG_MODELS,
        },
    ]
