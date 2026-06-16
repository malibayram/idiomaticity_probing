"""Static embedder (Word2Vec / GloVe / fastText) via gensim KeyedVectors.

Recipe from the paper: word vectors come straight from the vocabulary; the sentence / NC
vector is the **mean of the in-vocabulary word vectors**, OOV words ignored. These models are
type-level (a single vector per word), so ``embed_span`` is context-independent.
"""

from __future__ import annotations

import numpy as np

from .base import BaseEmbedder, Span, register


@register("static")
class StaticEmbedder(BaseEmbedder):
    contextual = False

    def __init__(
        self,
        path: str,
        name: str | None = None,
        binary: bool | None = None,
        no_header: bool = False,
        lowercase: bool = True,
        **_: object,
    ) -> None:
        super().__init__(name=name or path)
        from gensim.models import KeyedVectors

        self.lowercase = lowercase
        if binary is None:
            binary = str(path).endswith(".bin")
        self.kv = KeyedVectors.load_word2vec_format(
            path, binary=binary, no_header=no_header
        )
        self.dim = self.kv.vector_size

    def _word_vecs(self, words):
        out = []
        for w in words:
            key = w.lower() if self.lowercase else w
            if key in self.kv:
                out.append(self.kv[key])
        return out

    def _pool(self, words) -> np.ndarray:
        vecs = self._word_vecs(words)
        if not vecs:
            return np.zeros(self.dim, dtype=np.float32)
        return np.mean(np.stack(vecs, axis=0), axis=0)

    def embed_sentence(self, sentence: str) -> np.ndarray:
        return self._pool(sentence.split())

    def embed_span(self, sentence: str, span: Span) -> np.ndarray:
        words = sentence.split()
        start, end = span
        return self._pool(words[start:end])
