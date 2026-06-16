#!/usr/bin/env python3
"""Small perturbation-control experiment for the idiomaticity probe setup.

This is intentionally tiny. It checks whether high similarity after a random substitution is
specific to idiomatic noun compounds, or whether the same effect appears for ordinary words and
ordinary two-word phrases in the same syntactic slot.

Outputs:
  - results.csv: one row per example x variant
  - summary.md: compact interpretation table
"""

from __future__ import annotations

import argparse
import csv
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Tuple

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer


Span = Tuple[int, int]


@dataclass(frozen=True)
class Example:
    group: str
    name: str
    original: str
    target: str
    variants: Dict[str, str]


EXAMPLES = [
    Example(
        group="idiomatic_nc",
        name="grey matter",
        original="These youngsters use their grey matter when the presentation is right.",
        target="grey matter",
        variants={
            "synonym": "brain",
            "component": "matter",
            "word_by_word": "silvery material",
            "random": "battlefront serviceman",
        },
    ),
    Example(
        group="idiomatic_nc",
        name="eager beaver",
        original="Eric was being an eager beaver and left work late.",
        target="eager beaver",
        variants={
            "synonym": "hard worker",
            "component": "beaver",
            "word_by_word": "restless rodent",
            "random": "petrol station",
        },
    ),
    Example(
        group="compositional_nc",
        name="economic aid",
        original="The committee approved economic aid for the region after the storm.",
        target="economic aid",
        variants={
            "synonym": "financial assistance",
            "component": "aid",
            "word_by_word": "budgetary assistance",
            "random": "kitchen table",
        },
    ),
    Example(
        group="compositional_nc",
        name="research lab",
        original="The students joined a research lab during the summer program.",
        target="research lab",
        variants={
            "synonym": "research facility",
            "component": "lab",
            "word_by_word": "investigation workplace",
            "random": "garden party",
        },
    ),
    Example(
        group="single_word_control",
        name="doctor",
        original="The doctor opened the door quickly.",
        target="doctor",
        variants={
            "synonym": "physician",
            "related": "nurse",
            "random": "carpet",
        },
    ),
    Example(
        group="single_word_control",
        name="apple",
        original="She bought a fresh apple from the market.",
        target="apple",
        variants={
            "synonym": "fruit",
            "related": "pear",
            "random": "engine",
        },
    ),
    Example(
        group="single_word_control",
        name="teacher",
        original="The teacher explained the problem clearly.",
        target="teacher",
        variants={
            "synonym": "instructor",
            "related": "professor",
            "random": "mountain",
        },
    ),
    Example(
        group="ordinary_two_word_control",
        name="red car",
        original="The red car stopped near the school gate.",
        target="red car",
        variants={
            "synonym": "crimson vehicle",
            "component": "car",
            "word_by_word": "scarlet automobile",
            "random": "coffee spoon",
        },
    ),
    Example(
        group="ordinary_two_word_control",
        name="coffee cup",
        original="She placed the coffee cup on the wooden table.",
        target="coffee cup",
        variants={
            "synonym": "mug",
            "component": "cup",
            "word_by_word": "java container",
            "random": "traffic signal",
        },
    ),
]


def replace_once(sentence: str, old: str, new: str) -> str:
    if sentence.count(old) != 1:
        raise ValueError(f"Expected exactly one occurrence of {old!r} in {sentence!r}")
    return sentence.replace(old, new, 1)


def phrase_span(sentence: str, phrase: str) -> Span:
    start = sentence.index(phrase)
    return start, start + len(phrase)


def cosine(x: np.ndarray, y: np.ndarray, eps: float = 1e-12) -> float:
    denom = np.linalg.norm(x) * np.linalg.norm(y)
    if denom < eps:
        return float("nan")
    return float(np.dot(x, y) / denom)


class LocalHFEmbedder:
    def __init__(self, model_id: str, last_n_layers: int = 4, local_files_only: bool = True):
        self.model_id = model_id
        self.last_n_layers = last_n_layers
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_id, local_files_only=local_files_only
        )
        self.model = AutoModel.from_pretrained(
            model_id,
            output_hidden_states=True,
            local_files_only=local_files_only,
        )
        self.model.eval()
        self.cache: dict[str, tuple[np.ndarray, list[tuple[int, int]]]] = {}

    def _token_vectors(self, text: str) -> tuple[np.ndarray, list[tuple[int, int]]]:
        if text in self.cache:
            return self.cache[text]
        enc = self.tokenizer(
            text,
            return_tensors="pt",
            return_offsets_mapping=True,
            truncation=True,
            max_length=128,
        )
        offsets = [tuple(x) for x in enc.pop("offset_mapping")[0].tolist()]
        with torch.no_grad():
            out = self.model(**enc)
        hs = out.hidden_states[-self.last_n_layers :]
        vectors = torch.stack(hs, dim=0).mean(dim=0)[0].float().cpu().numpy()
        self.cache[text] = (vectors, offsets)
        return vectors, offsets

    def embed_sentence(self, text: str) -> np.ndarray:
        vectors, offsets = self._token_vectors(text)
        rows = [vectors[i] for i, (a, b) in enumerate(offsets) if b > a]
        return np.mean(np.stack(rows, axis=0), axis=0)

    def embed_span(self, text: str, span: Span) -> np.ndarray:
        vectors, offsets = self._token_vectors(text)
        start, end = span
        rows = [
            vectors[i]
            for i, (a, b) in enumerate(offsets)
            if b > a and not (b <= start or a >= end)
        ]
        if not rows:
            raise ValueError(f"No subtokens found for span={span} in {text!r}")
        return np.mean(np.stack(rows, axis=0), axis=0)


def mean(values: Iterable[float]) -> float:
    vals = list(values)
    return float(np.mean(vals)) if vals else float("nan")


def build_rows(embedder: LocalHFEmbedder) -> list[dict]:
    rows = []
    for ex in EXAMPLES:
        orig_span = phrase_span(ex.original, ex.target)
        orig_sentence_vec = embedder.embed_sentence(ex.original)
        orig_context_span_vec = embedder.embed_span(ex.original, orig_span)
        orig_isolated_vec = embedder.embed_sentence(ex.target)

        for variant, replacement in ex.variants.items():
            changed = replace_once(ex.original, ex.target, replacement)
            changed_span = phrase_span(changed, replacement)

            sentence_sim = cosine(orig_sentence_vec, embedder.embed_sentence(changed))
            contextual_span_sim = cosine(
                orig_context_span_vec, embedder.embed_span(changed, changed_span)
            )
            isolated_phrase_sim = cosine(
                orig_isolated_vec, embedder.embed_sentence(replacement)
            )

            rows.append(
                {
                    "group": ex.group,
                    "case": ex.name,
                    "variant": variant,
                    "target": ex.target,
                    "replacement": replacement,
                    "sentence_sim": sentence_sim,
                    "contextual_span_sim": contextual_span_sim,
                    "isolated_phrase_sim": isolated_phrase_sim,
                    "changed_sentence": changed,
                }
            )
    return rows


def write_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_summary(rows: list[dict], path: Path, model_id: str) -> None:
    groups = sorted({r["group"] for r in rows})
    variants = ["synonym", "component", "word_by_word", "related", "random"]

    lines = [
        "# Perturbation Control Özeti",
        "",
        f"Model: `{model_id}`",
        "",
        "Skorlar kosinüs benzerliğidir. Yüksek değer, orijinal ve değiştirilmiş ifadenin",
        "model uzayında daha yakın göründüğü anlamına gelir.",
        "",
        "## Grup Bazında Ortalama Benzerlikler",
        "",
        "| group | variant | sentence_sim | contextual_span_sim | isolated_phrase_sim |",
        "|---|---:|---:|---:|---:|",
    ]

    for group in groups:
        for variant in variants:
            subset = [r for r in rows if r["group"] == group and r["variant"] == variant]
            if not subset:
                continue
            lines.append(
                "| {group} | {variant} | {sent:.3f} | {ctx:.3f} | {iso:.3f} |".format(
                    group=group,
                    variant=variant,
                    sent=mean(float(r["sentence_sim"]) for r in subset),
                    ctx=mean(float(r["contextual_span_sim"]) for r in subset),
                    iso=mean(float(r["isolated_phrase_sim"]) for r in subset),
                )
            )

    lines.extend(
        [
            "",
            "## Synonym - Random Farkı",
            "",
            "| group | sentence_gap | contextual_span_gap | isolated_phrase_gap |",
            "|---|---:|---:|---:|",
        ]
    )

    for group in groups:
        syn = [r for r in rows if r["group"] == group and r["variant"] == "synonym"]
        rnd = [r for r in rows if r["group"] == group and r["variant"] == "random"]
        if not syn or not rnd:
            continue
        lines.append(
            "| {group} | {sent:.3f} | {ctx:.3f} | {iso:.3f} |".format(
                group=group,
                sent=mean(float(r["sentence_sim"]) for r in syn)
                - mean(float(r["sentence_sim"]) for r in rnd),
                ctx=mean(float(r["contextual_span_sim"]) for r in syn)
                - mean(float(r["contextual_span_sim"]) for r in rnd),
                iso=mean(float(r["isolated_phrase_sim"]) for r in syn)
                - mean(float(r["isolated_phrase_sim"]) for r in rnd),
            )
        )

    random_rows = [r for r in rows if r["variant"] == "random"]
    random_ctx = mean(float(r["contextual_span_sim"]) for r in random_rows)
    random_iso = mean(float(r["isolated_phrase_sim"]) for r in random_rows)
    random_sent = mean(float(r["sentence_sim"]) for r in random_rows)

    lines.extend(
        [
            "",
            "## Otomatik Okuma",
            "",
            f"- Sentence-level ortalama random replacement benzerliği: `{random_sent:.3f}`.",
            f"- Contextual span ortalama random replacement benzerliği: `{random_ctx:.3f}`.",
            f"- Isolated phrase ortalama random replacement benzerliği: `{random_iso:.3f}`.",
            "",
            "Okuma ilkesi: random replacement skorları sıradan kontrollerde de yüksek kalıyorsa,",
            "problem yalnızca idiomatiklik değildir; ortak cümle iskeleti, syntactic slot,",
            "contextualization veya modelin yüksek similarity floor'u ölçümü etkiliyor olabilir.",
            "Buna karşılık sıradan kontroller synonym-random ayrımını iyi yaparken idiomatik NC'ler",
            "yapamıyorsa, bu idiomatiklik iddiasını destekler; fakat bu ayrımı göstermek için",
            "ordinary-word / ordinary-phrase kontrolü raporlanmalıdır.",
        ]
    )

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="alibayram/embeddingmagibu-200m")
    parser.add_argument("--out", default="experiments/perturbation_control")
    parser.add_argument("--allow-downloads", action="store_true")
    args = parser.parse_args()

    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    out_dir = Path(args.out)
    embedder = LocalHFEmbedder(
        args.model,
        local_files_only=not args.allow_downloads,
    )
    rows = build_rows(embedder)
    write_csv(rows, out_dir / "results.csv")
    write_summary(rows, out_dir / "summary.md", args.model)

    print(f"Wrote {out_dir / 'results.csv'}")
    print(f"Wrote {out_dir / 'summary.md'}")


if __name__ == "__main__":
    main()
