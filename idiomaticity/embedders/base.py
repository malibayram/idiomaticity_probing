"""Model-agnostic embedder interface and registry.

Every word-representation model used in the paper (static, ELMo, BERT-family, Sentence-BERT,
Llama2, API embeddings) is reduced to the same contract:

    embed_sentence(sentence)      -> 1-D vector for the whole sentence
    embed_span(sentence, span)    -> 1-D vector for the target tokens (the NC or a probe)

``span`` is a ``(start_word, end_word)`` half-open range over *whitespace tokens* of the
sentence. This matches the paper's NCIMP ``*_tag`` columns, which mark which words make up the
target. Sentence-only models (e.g. API embeddings) may fall back to ``embed_sentence``.

Both granularities matter: the paper reports results at the *sentence* level (Figure 1) and at
the *NC* level (Figure 2). Keeping both on the interface lets the experiment compute each.
"""

from __future__ import annotations

import abc
from typing import Callable, Dict, Tuple, TYPE_CHECKING

if TYPE_CHECKING:  # keep import light so the core works without numpy-heavy stacks
    import numpy as np

Span = Tuple[int, int]

# --------------------------------------------------------------------------------------
# Registry: maps a string ``type`` (used in models.yaml) to an embedder class.
# --------------------------------------------------------------------------------------
_REGISTRY: Dict[str, type] = {}


def register(type_name: str) -> Callable[[type], type]:
    """Class decorator that registers an embedder under ``type_name``."""

    def _wrap(cls: type) -> type:
        if type_name in _REGISTRY:
            raise ValueError(f"Embedder type '{type_name}' already registered")
        _REGISTRY[type_name] = cls
        cls.type_name = type_name
        return cls

    return _wrap


def available_types() -> list[str]:
    return sorted(_REGISTRY)


def build_embedder(config: dict) -> "BaseEmbedder":
    """Instantiate an embedder from a config dict.

    ``config`` must contain ``type`` (one of :func:`available_types`); all other keys are
    forwarded to the embedder constructor. Sub-modules are imported lazily so that importing
    this module never drags in torch/gensim unless actually needed.
    """
    cfg = dict(config)
    type_name = cfg.pop("type", None)
    if type_name is None:
        raise ValueError(f"Model config is missing 'type': {config!r}")

    if type_name not in _REGISTRY:
        # Lazy-import the sub-modules so their @register side effects fire.
        _autoload()
    if type_name not in _REGISTRY:
        raise ValueError(
            f"Unknown embedder type '{type_name}'. Available: {available_types()}"
        )
    return _REGISTRY[type_name](**cfg)


def _autoload() -> None:
    """Import bundled embedder modules to populate the registry (best-effort)."""
    import importlib

    for mod in ("mock", "static", "transformer", "sentence", "causal", "multimodal", "mlx_causal"):
        try:
            importlib.import_module(f"idiomaticity.embedders.{mod}")
        except Exception:
            # A missing optional dependency (e.g. torch) must not break the others.
            pass


class BaseEmbedder(abc.ABC):
    """Abstract contract every model must satisfy.

    Subclasses are registered with ``@register("name")`` and constructed from config via
    :func:`build_embedder`. Implementations are responsible for their own caching if useful,
    but the experiment layer also caches at the call site.
    """

    type_name: str = "base"
    #: Whether the model produces genuinely contextual span vectors. If ``False`` (static /
    #: sentence-only), ``embed_span`` ignores context beyond the target words.
    contextual: bool = True

    def __init__(self, name: str | None = None, **_: object) -> None:
        self.name = name or self.__class__.__name__

    @abc.abstractmethod
    def embed_sentence(self, sentence: str) -> "np.ndarray":
        """Return a 1-D vector for the whole sentence (mean pooling of token vectors)."""

    @abc.abstractmethod
    def embed_span(self, sentence: str, span: Span) -> "np.ndarray":
        """Return a 1-D vector for the target words ``sentence.split()[start:end]``.

        Contextual models should pool only the sub-tokens belonging to the span while still
        attending to the full sentence; static models pool the span words in isolation.
        """

    # -- convenience -------------------------------------------------------------------
    def embed(self, sentence: str, span: Span | None) -> "np.ndarray":
        """Dispatch to span- or sentence-level embedding."""
        if span is None:
            return self.embed_sentence(sentence)
        return self.embed_span(sentence, span)

    def __repr__(self) -> str:  # pragma: no cover - cosmetic
        return f"{self.__class__.__name__}(name={self.name!r})"
