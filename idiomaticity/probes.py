"""Probe definitions (Section 3.3.1 of the paper).

Each probe replaces the target NC in a sentence with a different substitution, inducing an
expected change in meaning - the *Linguistic Prediction* (LP). The four probes:

    P_Syn       gold holistic synonym of the NC          -> high similarity always
    P_Comp      the most meaning-preserving component     -> high if compositional, else low
    P_WordsSyn  word-by-word synonyms of the components   -> high if compositional, else low
                                                             (strong correlation with Comp)
    P_Rand      frequency-matched random expression        -> low similarity always (lower bound)

These names and predictions are fixed; they are model-independent. The experiment substitutes
each probe into a sentence and measures the similarity of the resulting representation to the
original.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Probe(str, Enum):
    SYN = "P_Syn"
    COMP = "P_Comp"
    WORDS_SYN = "P_WordsSyn"
    RAND = "P_Rand"

    @property
    def label(self) -> str:
        return self.value


@dataclass(frozen=True)
class ProbeSpec:
    """Static metadata about a probe: its expected behaviour, for documentation and the
    "ideal values" reference panel in plots."""

    probe: Probe
    description: str
    #: Expected similarity band, used only for the "Ideal Values" reference panel.
    ideal_low: float
    ideal_high: float
    #: Whether similarity is expected to correlate with the human Comp score.
    correlates_with_comp: bool


PROBE_SPECS: dict[Probe, ProbeSpec] = {
    Probe.SYN: ProbeSpec(
        Probe.SYN,
        "Gold holistic synonym of the NC; near-perfect paraphrase regardless of idiomaticity.",
        ideal_low=0.9,
        ideal_high=1.0,
        correlates_with_comp=False,
    ),
    Probe.COMP: ProbeSpec(
        Probe.COMP,
        "Single most meaning-preserving component word (head or modifier).",
        ideal_low=0.4,
        ideal_high=0.6,
        correlates_with_comp=True,
    ),
    Probe.WORDS_SYN: ProbeSpec(
        Probe.WORDS_SYN,
        "Word-by-word synonyms of the components; loses meaning for idiomatic NCs.",
        ideal_low=0.4,
        ideal_high=0.6,
        correlates_with_comp=True,
    ),
    Probe.RAND: ProbeSpec(
        Probe.RAND,
        "Frequency-matched random two-word expression; control / lower bound.",
        ideal_low=0.0,
        ideal_high=0.2,
        correlates_with_comp=False,
    ),
}

#: Order used consistently across results tables and plots.
PROBE_ORDER: list[Probe] = [Probe.SYN, Probe.COMP, Probe.WORDS_SYN, Probe.RAND]
