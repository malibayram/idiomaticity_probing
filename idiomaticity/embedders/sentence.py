"""Sentence-level embedder (sentence-transformers: SBERT, mSBERT, BGE, E5, GTE, ...).

These models expose a single pooled vector per input string. The paper uses Sentence-BERT and
the OpenAI API at the sentence level only (NC-level inspection of the whole model is not
possible for an API), so ``embed_span`` falls back to embedding the span's words as their own
mini-"sentence". This keeps the interface uniform while staying faithful to how such models
are meant to be used.
"""

from __future__ import annotations

import numpy as np

from .base import BaseEmbedder, Span, register


@register("sentence")
class SentenceEmbedder(BaseEmbedder):
    # Span vectors are produced by re-encoding the span text, so they are not contextual in
    # the per-token sense the paper uses for BERT.
    contextual = False

    def __init__(
        self,
        hf_id: str,
        name: str | None = None,
        device: str | None = None,
        **_: object,
    ) -> None:
        super().__init__(name=name or hf_id)
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(hf_id, device=device)

    def embed_sentence(self, sentence: str) -> np.ndarray:
        return np.asarray(
            self.model.encode(sentence, normalize_embeddings=False), dtype=np.float32
        )

    def embed_span(self, sentence: str, span: Span) -> np.ndarray:
        words = sentence.split()
        start, end = span
        span_text = " ".join(words[start:end]) or sentence
        return self.embed_sentence(span_text)
