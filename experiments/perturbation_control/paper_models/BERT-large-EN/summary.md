# Perturbation Control Özeti

Model: `bert-large-uncased`
Örnek sayısı: `64` · Ölçüm satırı: `240`

Skorlar kosinüs benzerliğidir. Yüksek değer, orijinal ve değiştirilmiş ifadenin
model uzayında daha yakın göründüğü anlamına gelir.

## Grup Bazında Ortalama Benzerlikler

| group | variant | sentence_sim | contextual_span_sim | isolated_phrase_sim |
|---|---:|---:|---:|---:|
| compositional_nc | synonym | 0.982 | 0.931 | 0.865 |
| compositional_nc | component | 0.980 | 0.876 | 0.745 |
| compositional_nc | word_by_word | 0.973 | 0.879 | 0.814 |
| compositional_nc | random | 0.938 | 0.717 | 0.686 |
| idiomatic_nc | synonym | 0.950 | 0.753 | 0.653 |
| idiomatic_nc | component | 0.961 | 0.809 | 0.717 |
| idiomatic_nc | word_by_word | 0.954 | 0.817 | 0.736 |
| idiomatic_nc | random | 0.924 | 0.665 | 0.677 |
| ordinary_two_word_control | synonym | 0.980 | 0.893 | 0.808 |
| ordinary_two_word_control | component | 0.979 | 0.897 | 0.718 |
| ordinary_two_word_control | word_by_word | 0.971 | 0.862 | 0.810 |
| ordinary_two_word_control | random | 0.931 | 0.687 | 0.680 |
| single_word_control | synonym | 0.986 | 0.894 | 0.827 |
| single_word_control | related | 0.982 | 0.844 | 0.813 |
| single_word_control | random | 0.949 | 0.636 | 0.720 |

## Synonym - Random Farkı

| group | sentence_gap | contextual_span_gap | isolated_phrase_gap |
|---|---:|---:|---:|
| compositional_nc | 0.044 | 0.214 | 0.179 |
| idiomatic_nc | 0.025 | 0.088 | -0.024 |
| ordinary_two_word_control | 0.048 | 0.206 | 0.128 |
| single_word_control | 0.037 | 0.259 | 0.107 |

## Otomatik Okuma

- Sentence-level ortalama random replacement benzerliği: `0.936`.
- Contextual span ortalama random replacement benzerliği: `0.676`.
- Isolated phrase ortalama random replacement benzerliği: `0.691`.

Okuma ilkesi: random replacement skorları sıradan kontrollerde de yüksek kalıyorsa,
problem yalnızca idiomatiklik değildir; ortak cümle iskeleti, syntactic slot,
contextualization veya modelin yüksek similarity floor'u ölçümü etkiliyor olabilir.
Buna karşılık sıradan kontroller synonym-random ayrımını iyi yaparken idiomatik NC'ler
yapamıyorsa, bu idiomatiklik iddiasını destekler; fakat bu ayrımı göstermek için
ordinary-word / ordinary-phrase kontrolü raporlanmalıdır.
