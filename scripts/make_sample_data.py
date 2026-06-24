#!/usr/bin/env python3
"""Generate a small synthetic NCIMP-style sample dataset in canonical JSON.

This is NOT the real NCIMP data - it is a tiny, hand-written set used for smoke tests and to
demonstrate the canonical format. Spans are computed automatically so they are always correct.
Run ``scripts/download_data.py`` for the real dataset.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from idiomaticity.data import NCInstance, dump_canonical_json, make_substitution  # noqa: E402
from idiomaticity.probes import Probe  # noqa: E402

# Each NC: class, comp_score (0=idiomatic..5=compositional), gold synonym, head, modifier,
# word-by-word synonym pair, random replacements, and a naturalistic template + neutral one.
NCS = [
    # nc, class, comp, syn, head, mod, words_syn, rand[], nat_template
    ("grey matter", "I", 0.95, "brain", "matter", "grey", "silvery material",
     ["battlefront serviceman", "supermarket city"],
     "These youngsters use their {nc} when the presentation is right"),
    ("eager beaver", "I", 0.80, "hard worker", "beaver", "eager", "restless rodent",
     ["battlefront serviceman", "petrol station"],
     "Eric was being an {nc} and left work late"),
    ("dutch courage", "PC", 2.34, "alcoholic courage", "courage", "dutch", "hollander bravery",
     ["wedding cake", "morning paper"],
     "We had to go down to the pub to get some {nc}"),
    ("eternal rest", "PC", 2.40, "death", "rest", "eternal", "permanent break",
     ["weekly meeting", "garden chair"],
     "They have been called home to their {nc} and we are left behind"),
    ("economic aid", "C", 4.13, "financial assistance", "aid", "economic", "budgetary assistance",
     ["random walk", "kitchen table"],
     "The USSR was soon giving Cuba {nc} and military support"),
    ("research lab", "C", 4.00, "research facility", "lab", "research", "investigation workplace",
     ["garden party", "summer holiday"],
     "Being part of a {nc} provides exciting fieldwork experiences"),
]

NEUTRAL_TEMPLATE = "This is a {nc}"


def build(lang: str = "EN"):
    items = []
    for nc, cls, comp, syn, head, mod, words_syn, rands, nat_tmpl in NCS:
        for context, tmpl, sid in (
            ("naturalistic", nat_tmpl, "S1"),
            ("neutral", NEUTRAL_TEMPLATE, None),
        ):
            original_sent = tmpl.format(nc=nc)
            original = make_substitution(original_sent, phrase=nc)

            probes = {}
            probes[Probe.SYN] = [make_substitution(tmpl.format(nc=syn), phrase=syn)]
            probes[Probe.COMP] = [make_substitution(tmpl.format(nc=head), phrase=head)]
            probes[Probe.WORDS_SYN] = [
                make_substitution(tmpl.format(nc=words_syn), phrase=words_syn)
            ]
            probes[Probe.RAND] = [
                make_substitution(tmpl.format(nc=r), phrase=r) for r in rands
            ]
            probes = {p: [s for s in subs if s] for p, subs in probes.items()}

            items.append(
                NCInstance(
                    nc=nc, lang=lang, context=context, comp_class=cls,
                    comp_score=comp, original=original, probes=probes, sent_id=sid,
                )
            )
    return items


def main() -> None:
    out_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sample"
    )
    items = build("EN")
    dump_canonical_json(items, os.path.join(out_dir, "EN.json"))
    print(f"Wrote {len(items)} instances to {out_dir}/EN.json")


if __name__ == "__main__":
    main()
