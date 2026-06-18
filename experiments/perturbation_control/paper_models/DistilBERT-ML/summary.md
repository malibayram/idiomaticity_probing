# Perturbation Control Özeti

Model: `distilbert-base-multilingual-cased`
Örnek sayısı: `64` · Ölçüm satırı: `240`

Skorlar kosinüs benzerliğidir. Yüksek değer, orijinal ve değiştirilmiş ifadenin
model uzayında daha yakın göründüğü anlamına gelir.

## Grup Bazında Ortalama Benzerlikler

| group | variant | sentence_sim | contextual_span_sim | isolated_phrase_sim |
|---|---:|---:|---:|---:|
| compositional_nc | synonym | 0.989 | 0.904 | 0.899 |
| compositional_nc | component | 0.992 | 0.903 | 0.876 |
| compositional_nc | word_by_word | 0.983 | 0.860 | 0.853 |
| compositional_nc | random | 0.965 | 0.753 | 0.752 |
| idiomatic_nc | synonym | 0.969 | 0.752 | 0.745 |
| idiomatic_nc | component | 0.991 | 0.902 | 0.883 |
| idiomatic_nc | word_by_word | 0.976 | 0.811 | 0.802 |
| idiomatic_nc | random | 0.967 | 0.763 | 0.747 |
| ordinary_two_word_control | synonym | 0.976 | 0.845 | 0.829 |
| ordinary_two_word_control | component | 0.989 | 0.913 | 0.878 |
| ordinary_two_word_control | word_by_word | 0.974 | 0.836 | 0.822 |
| ordinary_two_word_control | random | 0.953 | 0.751 | 0.740 |
| single_word_control | synonym | 0.987 | 0.825 | 0.811 |
| single_word_control | related | 0.986 | 0.822 | 0.823 |
| single_word_control | random | 0.966 | 0.689 | 0.716 |

## Synonym - Random Farkı

| group | sentence_gap | contextual_span_gap | isolated_phrase_gap |
|---|---:|---:|---:|
| compositional_nc | 0.023 | 0.152 | 0.147 |
| idiomatic_nc | 0.002 | -0.011 | -0.002 |
| ordinary_two_word_control | 0.023 | 0.094 | 0.089 |
| single_word_control | 0.021 | 0.136 | 0.096 |

## Otomatik Okuma

- Sentence-level ortalama random replacement benzerliği: `0.963`.
- Contextual span ortalama random replacement benzerliği: `0.739`.
- Isolated phrase ortalama random replacement benzerliği: `0.739`.

Okuma ilkesi: random replacement skorları sıradan kontrollerde de yüksek kalıyorsa,
problem yalnızca idiomatiklik değildir; ortak cümle iskeleti, syntactic slot,
contextualization veya modelin yüksek similarity floor'u ölçümü etkiliyor olabilir.
Buna karşılık sıradan kontroller synonym-random ayrımını iyi yaparken idiomatik NC'ler
yapamıyorsa, bu idiomatiklik iddiasını destekler; fakat bu ayrımı göstermek için
ordinary-word / ordinary-phrase kontrolü raporlanmalıdır.
