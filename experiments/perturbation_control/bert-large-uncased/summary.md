# Perturbation Control Özeti

Model: `bert-large-uncased`

Skorlar kosinüs benzerliğidir. Yüksek değer, orijinal ve değiştirilmiş ifadenin
model uzayında daha yakın göründüğü anlamına gelir.

## Grup Bazında Ortalama Benzerlikler

| group | variant | sentence_sim | contextual_span_sim | isolated_phrase_sim |
|---|---:|---:|---:|---:|
| compositional_nc | synonym | 0.988 | 0.942 | 0.896 |
| compositional_nc | component | 0.987 | 0.915 | 0.706 |
| compositional_nc | word_by_word | 0.969 | 0.834 | 0.793 |
| compositional_nc | random | 0.939 | 0.723 | 0.684 |
| idiomatic_nc | synonym | 0.968 | 0.761 | 0.629 |
| idiomatic_nc | component | 0.944 | 0.650 | 0.735 |
| idiomatic_nc | word_by_word | 0.958 | 0.796 | 0.723 |
| idiomatic_nc | random | 0.901 | 0.671 | 0.632 |
| ordinary_two_word_control | synonym | 0.985 | 0.879 | 0.704 |
| ordinary_two_word_control | component | 0.985 | 0.892 | 0.680 |
| ordinary_two_word_control | word_by_word | 0.980 | 0.842 | 0.714 |
| ordinary_two_word_control | random | 0.953 | 0.626 | 0.691 |
| single_word_control | synonym | 0.990 | 0.912 | 0.836 |
| single_word_control | related | 0.975 | 0.837 | 0.806 |
| single_word_control | random | 0.943 | 0.627 | 0.708 |

## Synonym - Random Farkı

| group | sentence_gap | contextual_span_gap | isolated_phrase_gap |
|---|---:|---:|---:|
| compositional_nc | 0.049 | 0.219 | 0.212 |
| idiomatic_nc | 0.067 | 0.089 | -0.002 |
| ordinary_two_word_control | 0.032 | 0.252 | 0.013 |
| single_word_control | 0.047 | 0.285 | 0.127 |

## Otomatik Okuma

- Sentence-level ortalama random replacement benzerliği: `0.935`.
- Contextual span ortalama random replacement benzerliği: `0.658`.
- Isolated phrase ortalama random replacement benzerliği: `0.682`.

Okuma ilkesi: random replacement skorları sıradan kontrollerde de yüksek kalıyorsa,
problem yalnızca idiomatiklik değildir; ortak cümle iskeleti, syntactic slot,
contextualization veya modelin yüksek similarity floor'u ölçümü etkiliyor olabilir.
Buna karşılık sıradan kontroller synonym-random ayrımını iyi yaparken idiomatik NC'ler
yapamıyorsa, bu idiomatiklik iddiasını destekler; fakat bu ayrımı göstermek için
ordinary-word / ordinary-phrase kontrolü raporlanmalıdır.
