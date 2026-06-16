"""Dependency-free mock embedder (numpy only).

Produces deterministic pseudo-random vectors from a hash of the text, with a mild bias so that
shared words yield more similar vectors. It captures *lexical overlap* — exactly the confound
the paper highlights (high similarity from word overlap rather than idiomatic understanding) —
which makes it a useful, honest smoke-test backend: it will show the "everything looks
similar" effect without any model download.

It does NOT measure real idiomaticity. Use a real embedder (transformer/static/sentence/causal)
for meaningful results.
"""

from __future__ import annotations

import hashlib

import numpy as np

from .base import BaseEmbedder, Span, register


@register("mock")
class MockEmbedder(BaseEmbedder):
    contextual = False

    def __init__(self, name: str | None = None, dim: int = 64, **_: object) -> None:
        super().__init__(name=name or "mock")
        self.dim = dim

    def _word_vec(self, word: str) -> np.ndarray:
        h = hashlib.sha256(word.lower().encode("utf-8")).digest()
        seed = int.from_bytes(h[:8], "little")
        rng = np.random.default_rng(seed)
        return rng.standard_normal(self.dim).astype(np.float32)

    def _pool(self, words) -> np.ndarray:
        vecs = [self._word_vec(w) for w in words if w]
        if not vecs:
            return np.zeros(self.dim, dtype=np.float32)
        return np.mean(np.stack(vecs, axis=0), axis=0)

    def embed_sentence(self, sentence: str) -> np.ndarray:
        return self._pool(sentence.split())

    def embed_span(self, sentence: str, span: Span) -> np.ndarray:
        words = sentence.split()
        start, end = span
        return self._pool(words[start:end])
