"""MLX (Apple Silicon) embedder for decoder-only / multimodal LLMs via mlx-lm / mlx-vlm.

Motivation: some 2026 LLMs (e.g. Qwen3.5) use linear attention whose fast kernels
(flash-linear-attention, causal-conv1d) are CUDA-only and unavailable on macOS, so the
HuggingFace/torch path falls back to a slow CPU implementation. MLX runs these models natively
and fast on Apple Silicon. ``mlx_lm.load`` (or ``mlx_vlm.load`` for multimodal/unified models
such as Gemma 4 ``gemma4_unified``) converts a base HF checkpoint to MLX on the fly, so we keep
the base, full-precision weights when a base checkpoint is given.

Layer recipe: to match He et al. (2025) and the torch ``transformer``/``causal`` embedders we
average the **last four layers** (paper §3.2.1: "for Transformer-based models ... we report
results using the last four layers"). mlx-lm/mlx-vlm expose only the final hidden state directly,
so we capture every decoder-layer output by temporarily wrapping the layers with a transparent
recorder and running the model's own forward (which handles masks/caches correctly), then mean
the last ``last_n_layers`` layer outputs. Sub-token offset mapping and span pooling are reused
from :class:`TransformerEmbedder`.
"""

from __future__ import annotations

import numpy as np

from .base import register
from .transformer import TransformerEmbedder


@register("mlx_causal")
class MLXCausalEmbedder(TransformerEmbedder):
    contextual = True

    def __init__(
        self,
        hf_id: str,
        name: str | None = None,
        last_n_layers: int = 4,
        max_length: int = 256,
        **_: object,
    ) -> None:
        from .base import BaseEmbedder

        BaseEmbedder.__init__(self, name=name or hf_id)
        import mlx.core as mx
        from mlx_lm import load
        from transformers import AutoTokenizer

        self._mx = mx
        self.hf_id = hf_id
        self.max_length = max_length
        self.last_n_layers = last_n_layers  # paper recipe: mean of the last 4 layers
        self.tokenizer = AutoTokenizer.from_pretrained(hf_id)
        try:
            self.model, _ = load(hf_id)
            self.backend = "mlx-lm"
        except Exception:
            from mlx_vlm import load as vlm_load

            self.model, _ = vlm_load(hf_id)
            self.backend = "mlx-vlm"
        self.text_model = self._find_text_model(self.model)
        self._install_recorders()

    # ------------------------------------------------------------------ setup
    @staticmethod
    def _find_text_model(model):
        """Locate the text backbone exposing embed_tokens + layers."""
        candidates = (("language_model", "model"), ("model",), ("language_model",), ())
        for path in candidates:
            obj = model
            ok = True
            for attr in path:
                if hasattr(obj, attr):
                    obj = getattr(obj, attr)
                else:
                    ok = False
                    break
            if ok and hasattr(obj, "embed_tokens") and hasattr(obj, "layers"):
                return obj
        return model

    def _install_recorders(self):
        """Wrap each decoder layer so a forward pass records its output (for last-N pooling)."""
        import mlx.core as mx
        import mlx.nn as nn

        store: list = []

        class _Recorder(nn.Module):
            def __init__(self, inner):
                super().__init__()
                self.inner = inner
                # Mirror inner's scalar attributes (e.g. layer_type, layer_idx) so the parent
                # model's mask/cache logic, which reads them off each layer, keeps working.
                for k, v in vars(inner).items():
                    if not isinstance(v, mx.array) and not callable(v) and not k.startswith("_"):
                        try:
                            setattr(self, k, v)
                        except Exception:
                            pass

            def __call__(self, *a, **k):
                out = self.inner(*a, **k)
                store.append(out[0] if isinstance(out, tuple) else out)
                return out

        self._layer_store = store
        try:
            self.text_model.layers = [_Recorder(l) for l in self.text_model.layers]
            self._recorded = True
        except Exception:
            self._recorded = False

    # ------------------------------------------------------------------ forward
    def _token_vectors(self, sentence: str):
        mx = self._mx
        enc = self.tokenizer(
            sentence,
            return_offsets_mapping=True,
            truncation=True,
            max_length=self.max_length,
        )
        offsets = enc["offset_mapping"]
        ids = mx.array([enc["input_ids"]])

        if self._recorded:
            self._layer_store.clear()
            out = self.text_model(ids)
            layers = self._layer_store
            if layers:
                n = min(self.last_n_layers, len(layers))
                h = sum(layers[-n:]) / n
                # Decoder-LLM layer outputs are the un-normalized residual stream; apply the
                # model's own final norm so the representation is comparable across models
                # (Gemma's raw residual is pathologically anisotropic without it).
                if hasattr(self.text_model, "norm"):
                    h = self.text_model.norm(h)
            else:  # recorder didn't fire; fall back to the forward output (already normed)
                h = out
        else:
            h = self.text_model(ids)

        h = h.astype(mx.float32)
        mx.eval(h)
        vectors = np.array(h[0])  # [T, hidden]
        return vectors, offsets
