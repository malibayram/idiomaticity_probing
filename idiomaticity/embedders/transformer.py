"""HuggingFace encoder embedder (BERT, mBERT, DistilBERT, RoBERTa, XLM-R, BERTurk, ...).

Reproduces the paper's extraction recipe for Transformer encoders:
  * word vectors = **mean of sub-token** representations,
  * using the **last N layers** (default 4, as in the paper),
  * sentence / NC vectors = mean pooling of the relevant word vectors.

Works for any ``AutoModel`` with ``output_hidden_states=True``. This is the main entry point
for applying the paper to *new* encoder models (e.g. ``xlm-roberta-large``,
``dbmdz/bert-base-turkish-cased``).
"""

from __future__ import annotations

from typing import Tuple

import numpy as np

from .base import BaseEmbedder, Span, register


@register("transformer")
class TransformerEmbedder(BaseEmbedder):
    contextual = True

    def __init__(
        self,
        hf_id: str,
        name: str | None = None,
        last_n_layers: int = 4,
        device: str | None = None,
        max_length: int = 256,
        dtype: str | None = None,
        **_: object,
    ) -> None:
        super().__init__(name=name or hf_id)
        import torch
        from transformers import AutoModel, AutoTokenizer

        self.hf_id = hf_id
        self.last_n_layers = last_n_layers
        self.max_length = max_length
        self._torch = torch
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        self.tokenizer = AutoTokenizer.from_pretrained(hf_id)
        model_kwargs = {"output_hidden_states": True}
        if dtype is not None:
            model_kwargs["torch_dtype"] = getattr(torch, dtype)
        self.model = AutoModel.from_pretrained(hf_id, **model_kwargs)
        self.model.eval().to(self.device)

    # ------------------------------------------------------------------ internals
    def _token_vectors(self, sentence: str):
        """Return (sub-token hidden states [T, H], offset_mapping) for ``sentence``.

        Hidden states are the mean over the last ``last_n_layers`` layers.
        """
        torch = self._torch
        enc = self.tokenizer(
            sentence,
            return_tensors="pt",
            return_offsets_mapping=True,
            truncation=True,
            max_length=self.max_length,
        )
        offsets = enc.pop("offset_mapping")[0].tolist()
        enc = {k: v.to(self.device) for k, v in enc.items()}
        with torch.no_grad():
            out = self.model(**enc)
        # hidden_states: tuple(num_layers+1) of [1, T, H]
        hs = out.hidden_states[-self.last_n_layers :]
        stacked = torch.stack(hs, dim=0).mean(dim=0)[0]  # [T, H]
        return stacked.float().cpu().numpy(), offsets

    @staticmethod
    def _char_span_of_words(sentence: str, span: Span) -> Tuple[int, int]:
        """Map a (start_word, end_word) whitespace span to a (char_start, char_end) range."""
        words = sentence.split()
        start_w, end_w = span
        # Rebuild char offsets of each whitespace token.
        offsets = []
        idx = 0
        for w in words:
            idx = sentence.index(w, idx)
            offsets.append((idx, idx + len(w)))
            idx += len(w)
        char_start = offsets[start_w][0]
        char_end = offsets[min(end_w, len(words)) - 1][1]
        return char_start, char_end

    def _pool_subtokens(self, vectors, offsets, char_start, char_end):
        """Mean-pool sub-token vectors whose char offsets overlap [char_start, char_end)."""
        rows = [
            vectors[i]
            for i, (a, b) in enumerate(offsets)
            if not (b <= char_start or a >= char_end) and b > a  # overlap & not special
        ]
        if not rows:
            return None
        return np.mean(np.stack(rows, axis=0), axis=0)

    # ------------------------------------------------------------------ public API
    def embed_sentence(self, sentence: str) -> np.ndarray:
        vectors, offsets = self._token_vectors(sentence)
        content = [vectors[i] for i, (a, b) in enumerate(offsets) if b > a]
        return np.mean(np.stack(content, axis=0), axis=0)

    def embed_span(self, sentence: str, span: Span) -> np.ndarray:
        vectors, offsets = self._token_vectors(sentence)
        char_start, char_end = self._char_span_of_words(sentence, span)
        pooled = self._pool_subtokens(vectors, offsets, char_start, char_end)
        if pooled is None:  # fallback: whole sentence
            return self.embed_sentence(sentence)
        return pooled
