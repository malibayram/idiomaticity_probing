# Perturbation Control Özeti

Model: `alibayram/embeddingmagibu-200m`

Skorlar kosinüs benzerliğidir. Yüksek değer, orijinal ve değiştirilmiş ifadenin
model uzayında daha yakın göründüğü anlamına gelir.

## Grup Bazında Ortalama Benzerlikler

| group | variant | sentence_sim | contextual_span_sim | isolated_phrase_sim |
|---|---:|---:|---:|---:|
| compositional_nc | synonym | 0.999 | 0.958 | 0.974 |
| compositional_nc | component | 0.999 | 0.950 | 0.936 |
| compositional_nc | word_by_word | 0.997 | 0.923 | 0.965 |
| compositional_nc | random | 0.994 | 0.840 | 0.940 |
| idiomatic_nc | synonym | 0.998 | 0.934 | 0.955 |
| idiomatic_nc | component | 0.999 | 0.974 | 0.960 |
| idiomatic_nc | word_by_word | 0.997 | 0.968 | 0.956 |
| idiomatic_nc | random | 0.996 | 0.946 | 0.954 |
| ordinary_two_word_control | synonym | 0.998 | 0.934 | 0.953 |
| ordinary_two_word_control | component | 0.999 | 0.953 | 0.972 |
| ordinary_two_word_control | word_by_word | 0.997 | 0.924 | 0.957 |
| ordinary_two_word_control | random | 0.995 | 0.865 | 0.951 |
| single_word_control | synonym | 0.999 | 0.948 | 0.917 |
| single_word_control | related | 0.998 | 0.890 | 0.913 |
| single_word_control | random | 0.996 | 0.822 | 0.890 |

## Synonym - Random Farkı

| group | sentence_gap | contextual_span_gap | isolated_phrase_gap |
|---|---:|---:|---:|
| compositional_nc | 0.004 | 0.118 | 0.035 |
| idiomatic_nc | 0.002 | -0.012 | 0.001 |
| ordinary_two_word_control | 0.003 | 0.069 | 0.002 |
| single_word_control | 0.003 | 0.125 | 0.027 |

## Otomatik Okuma

- Sentence-level ortalama random replacement benzerliği: `0.995`.
- Contextual span ortalama random replacement benzerliği: `0.863`.
- Isolated phrase ortalama random replacement benzerliği: `0.929`.

Okuma ilkesi: random replacement skorları sıradan kontrollerde de yüksek kalıyorsa,
problem yalnızca idiomatiklik değildir; ortak cümle iskeleti, syntactic slot,
contextualization veya modelin yüksek similarity floor'u ölçümü etkiliyor olabilir.
Buna karşılık sıradan kontroller synonym-random ayrımını iyi yaparken idiomatik NC'ler
yapamıyorsa, bu idiomatiklik iddiasını destekler; fakat bu ayrımı göstermek için
ordinary-word / ordinary-phrase kontrolü raporlanmalıdır.
