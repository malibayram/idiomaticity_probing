"""Autoregressive / decoder-only LM embedder (Llama2/3, Qwen, Mistral, Gemma, ...).

Same recipe as the encoder embedder - mean of sub-token hidden states over the last N layers
- but for causal LMs loaded via ``AutoModelForCausalLM``. This is how the paper treats
Llama2, and the natural way to extend the study to modern open LLMs.

Note: decoder-only models are causal, so a token only attends to its left context. The paper
still pools sub-token states the same way; we follow that for comparability.
"""

from __future__ import annotations

import numpy as np

from .base import Span, register
from .transformer import TransformerEmbedder


@register("causal")
class CausalLMEmbedder(TransformerEmbedder):
    contextual = True

    def __init__(
        self,
        hf_id: str,
        name: str | None = None,
        last_n_layers: int = 4,
        device: str | None = None,
        max_length: int = 256,
        dtype: str | None = "float16",
        **_: object,
    ) -> None:
        # Bypass TransformerEmbedder.__init__ (it loads AutoModel); load a causal LM instead.
        from .base import BaseEmbedder

        BaseEmbedder.__init__(self, name=name or hf_id)
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.hf_id = hf_id
        self.last_n_layers = last_n_layers
        self.max_length = max_length
        self._torch = torch
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        self.tokenizer = AutoTokenizer.from_pretrained(hf_id)
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
        model_kwargs = {"output_hidden_states": True}
        if dtype is not None:
            model_kwargs["torch_dtype"] = getattr(torch, dtype)
        self.model = AutoModelForCausalLM.from_pretrained(hf_id, **model_kwargs)
        self.model.eval().to(self.device)

    # Some tokenizers lack fast offset mapping; guard span pooling.
    def embed_span(self, sentence: str, span: Span) -> np.ndarray:  # pragma: no cover
        try:
            return super().embed_span(sentence, span)
        except (NotImplementedError, ValueError):
            return self.embed_sentence(sentence)
