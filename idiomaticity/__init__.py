"""Model-agnostic re-implementation of He et al. (2025),
*Investigating Idiomaticity in Word Representations* (Computational Linguistics 51(2)).

The probing methodology (probes + Sim / Affinity / Scaled Similarity / Spearman) is held
fixed; word-representation models are pluggable via ``idiomaticity.embedders``.
"""

__version__ = "0.1.0"
