# Perturbation Control Özeti

Model: `alibayram/embeddingmagibu-200m`
Örnek sayısı: `64` · Ölçüm satırı: `240`

Skorlar kosinüs benzerliğidir. Yüksek değer, orijinal ve değiştirilmiş ifadenin
model uzayında daha yakın göründüğü anlamına gelir.

## Grup Bazında Ortalama Benzerlikler

| group | variant | sentence_sim | contextual_span_sim | isolated_phrase_sim |
|---|---:|---:|---:|---:|
| compositional_nc | synonym | 0.999 | 0.967 | 0.974 |
| compositional_nc | component | 0.999 | 0.953 | 0.966 |
| compositional_nc | word_by_word | 0.998 | 0.949 | 0.965 |
| compositional_nc | random | 0.995 | 0.892 | 0.941 |
| idiomatic_nc | synonym | 0.996 | 0.948 | 0.952 |
| idiomatic_nc | component | 0.999 | 0.975 | 0.964 |
| idiomatic_nc | word_by_word | 0.998 | 0.970 | 0.962 |
| idiomatic_nc | random | 0.996 | 0.949 | 0.957 |
| ordinary_two_word_control | synonym | 0.998 | 0.957 | 0.967 |
| ordinary_two_word_control | component | 0.999 | 0.961 | 0.970 |
| ordinary_two_word_control | word_by_word | 0.997 | 0.946 | 0.955 |
| ordinary_two_word_control | random | 0.995 | 0.905 | 0.945 |
| single_word_control | synonym | 0.999 | 0.960 | 0.946 |
| single_word_control | related | 0.998 | 0.931 | 0.946 |
| single_word_control | random | 0.996 | 0.869 | 0.916 |

## Synonym - Random Farkı

| group | sentence_gap | contextual_span_gap | isolated_phrase_gap |
|---|---:|---:|---:|
| compositional_nc | 0.004 | 0.075 | 0.032 |
| idiomatic_nc | 0.000 | -0.002 | -0.005 |
| ordinary_two_word_control | 0.003 | 0.052 | 0.021 |
| single_word_control | 0.003 | 0.092 | 0.030 |

## Otomatik Okuma

- Sentence-level ortalama random replacement benzerliği: `0.996`.
- Contextual span ortalama random replacement benzerliği: `0.904`.
- Isolated phrase ortalama random replacement benzerliği: `0.940`.

Okuma ilkesi: random replacement skorları sıradan kontrollerde de yüksek kalıyorsa,
problem yalnızca idiomatiklik değildir; ortak cümle iskeleti, syntactic slot,
contextualization veya modelin yüksek similarity floor'u ölçümü etkiliyor olabilir.
Buna karşılık sıradan kontroller synonym-random ayrımını iyi yaparken idiomatik NC'ler
yapamıyorsa, bu idiomatiklik iddiasını destekler; fakat bu ayrımı göstermek için
ordinary-word / ordinary-phrase kontrolü raporlanmalıdır.
