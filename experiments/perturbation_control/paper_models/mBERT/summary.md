# Perturbation Control Özeti

Model: `bert-base-multilingual-cased`
Örnek sayısı: `64` · Ölçüm satırı: `240`

Skorlar kosinüs benzerliğidir. Yüksek değer, orijinal ve değiştirilmiş ifadenin
model uzayında daha yakın göründüğü anlamına gelir.

## Grup Bazında Ortalama Benzerlikler

| group | variant | sentence_sim | contextual_span_sim | isolated_phrase_sim |
|---|---:|---:|---:|---:|
| compositional_nc | synonym | 0.987 | 0.935 | 0.918 |
| compositional_nc | component | 0.988 | 0.915 | 0.879 |
| compositional_nc | word_by_word | 0.982 | 0.907 | 0.879 |
| compositional_nc | random | 0.960 | 0.812 | 0.815 |
| idiomatic_nc | synonym | 0.962 | 0.810 | 0.834 |
| idiomatic_nc | component | 0.986 | 0.919 | 0.916 |
| idiomatic_nc | word_by_word | 0.977 | 0.874 | 0.867 |
| idiomatic_nc | random | 0.962 | 0.822 | 0.832 |
| ordinary_two_word_control | synonym | 0.972 | 0.880 | 0.880 |
| ordinary_two_word_control | component | 0.985 | 0.921 | 0.897 |
| ordinary_two_word_control | word_by_word | 0.972 | 0.874 | 0.870 |
| ordinary_two_word_control | random | 0.943 | 0.775 | 0.819 |
| single_word_control | synonym | 0.985 | 0.897 | 0.860 |
| single_word_control | related | 0.984 | 0.892 | 0.869 |
| single_word_control | random | 0.957 | 0.755 | 0.787 |

## Synonym - Random Farkı

| group | sentence_gap | contextual_span_gap | isolated_phrase_gap |
|---|---:|---:|---:|
| compositional_nc | 0.027 | 0.123 | 0.103 |
| idiomatic_nc | 0.000 | -0.012 | 0.002 |
| ordinary_two_word_control | 0.030 | 0.105 | 0.061 |
| single_word_control | 0.028 | 0.143 | 0.074 |

## Otomatik Okuma

- Sentence-level ortalama random replacement benzerliği: `0.955`.
- Contextual span ortalama random replacement benzerliği: `0.791`.
- Isolated phrase ortalama random replacement benzerliği: `0.813`.

Okuma ilkesi: random replacement skorları sıradan kontrollerde de yüksek kalıyorsa,
problem yalnızca idiomatiklik değildir; ortak cümle iskeleti, syntactic slot,
contextualization veya modelin yüksek similarity floor'u ölçümü etkiliyor olabilir.
Buna karşılık sıradan kontroller synonym-random ayrımını iyi yaparken idiomatik NC'ler
yapamıyorsa, bu idiomatiklik iddiasını destekler; fakat bu ayrımı göstermek için
ordinary-word / ordinary-phrase kontrolü raporlanmalıdır.
