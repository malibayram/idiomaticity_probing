"""Text embedder for multimodal (image-text-to-text) decoder LLMs.

Newest-generation models such as Gemma 4 (``Gemma4ForConditionalGeneration`` /
``Gemma4UnifiedForConditionalGeneration``) and Qwen-VL are *not* plain ``…ForCausalLM``; they
wrap a text backbone inside an image-text-to-text model. For our probing we only need the
**text** hidden states. This embedder loads the multimodal model and runs a **text-only**
forward pass (no pixel/audio inputs), reusing the same sub-token mean-pooling and last-N-layer
recipe as :class:`TransformerEmbedder`.

Registered as ``multimodal_causal``. Works for Gemma 4 (text path) and similar models. If a
model is actually a plain causal LM, prefer the ``causal`` embedder instead.
"""

from __future__ import annotations

import numpy as np

from .base import register
from .transformer import TransformerEmbedder


@register("multimodal_causal")
class MultimodalCausalEmbedder(TransformerEmbedder):
    contextual = True

    def __init__(
        self,
        hf_id: str,
        name: str | None = None,
        last_n_layers: int = 4,
        device: str | None = None,
        max_length: int = 256,
        dtype: str | None = "float16",
        trust_remote_code: bool = False,
        **_: object,
    ) -> None:
        from .base import BaseEmbedder

        BaseEmbedder.__init__(self, name=name or hf_id)
        import torch

        self.hf_id = hf_id
        self.last_n_layers = last_n_layers
        self.max_length = max_length
        self._torch = torch
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")

        self.tokenizer = self._load_tokenizer(hf_id, trust_remote_code)
        self.model = self._load_model(hf_id, dtype, trust_remote_code)
        self.model.eval().to(self.device)
        self._text_backbone = None  # resolved lazily on first failure

    # ------------------------------------------------------------------ loading
    @staticmethod
    def _load_tokenizer(hf_id, trust_remote_code):
        from transformers import AutoTokenizer

        try:
            return AutoTokenizer.from_pretrained(hf_id, trust_remote_code=trust_remote_code)
        except Exception:
            from transformers import AutoProcessor

            proc = AutoProcessor.from_pretrained(hf_id, trust_remote_code=trust_remote_code)
            return getattr(proc, "tokenizer", proc)

    def _load_model(self, hf_id, dtype, trust_remote_code):
        import torch
        from transformers import AutoModelForImageTextToText

        kwargs = {"output_hidden_states": True, "trust_remote_code": trust_remote_code}
        if dtype is not None:
            kwargs["torch_dtype"] = getattr(torch, dtype)
        try:
            return AutoModelForImageTextToText.from_pretrained(hf_id, **kwargs)
        except Exception:
            # Last resort: generic AutoModel (returns the text/multimodal backbone).
            from transformers import AutoModel

            return AutoModel.from_pretrained(hf_id, **kwargs)

    # ------------------------------------------------------------------ forward
    def _text_lm(self):
        """Locate the text backbone submodule for a text-only forward pass."""
        if self._text_backbone is not None:
            return self._text_backbone
        m = self.model
        for path in (("model", "language_model"), ("language_model",),
                     ("model", "text_model"), ("text_model",), ("model",)):
            obj = m
            ok = True
            for attr in path:
                if hasattr(obj, attr):
                    obj = getattr(obj, attr)
                else:
                    ok = False
                    break
            if ok and obj is not m:
                self._text_backbone = obj
                return obj
        self._text_backbone = m
        return m

    def _token_vectors(self, sentence: str):
        torch = self._torch
        enc = self.tokenizer(
            sentence,
            return_tensors="pt",
            return_offsets_mapping=True,
            truncation=True,
            max_length=self.max_length,
        )
        offsets = enc.pop("offset_mapping")[0].tolist()
        # Keep only the plain text inputs (drop any multimodal-specific kwargs).
        inputs = {
            k: v.to(self.device)
            for k, v in enc.items()
            if k in ("input_ids", "attention_mask")
        }
        with torch.no_grad():
            out = self._forward_text(inputs)
        hs = out.hidden_states[-self.last_n_layers :]
        stacked = torch.stack(hs, dim=0).mean(dim=0)[0]
        return stacked.float().cpu().numpy(), offsets

    def _forward_text(self, inputs):
        # Try the full model first; if it doesn't return text hidden states, use the backbone.
        try:
            out = self.model(**inputs, output_hidden_states=True)
            if getattr(out, "hidden_states", None) is not None:
                return out
        except Exception:
            pass
        return self._text_lm()(**inputs, output_hidden_states=True)
