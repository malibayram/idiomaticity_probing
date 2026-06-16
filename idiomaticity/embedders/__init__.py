"""Pluggable word-representation models.

Public API:
    BaseEmbedder, register, build_embedder, available_types
"""

from .base import BaseEmbedder, available_types, build_embedder, register

__all__ = ["BaseEmbedder", "register", "build_embedder", "available_types"]
