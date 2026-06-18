# Perturbation Control Özeti

Model: `sentence-transformers/distiluse-base-multilingual-cased`
Örnek sayısı: `64` · Ölçüm satırı: `240`

Skorlar kosinüs benzerliğidir. Yüksek değer, orijinal ve değiştirilmiş ifadenin
model uzayında daha yakın göründüğü anlamına gelir.


Not: Bu sentence-transformers tipi bir modeldir; gerçek contextual token-span
vermez. Bu yüzden `contextual_span_sim`, hedef ifadenin cümleden kesilip ayrı
encode edilmesiyle hesaplanır ve `isolated_phrase_sim` ile aynı yoruma sahiptir.
## Grup Bazında Ortalama Benzerlikler

| group | variant | sentence_sim | contextual_span_sim | isolated_phrase_sim |
|---|---:|---:|---:|---:|
| compositional_nc | synonym | 0.895 | 0.725 | 0.725 |
| compositional_nc | component | 0.907 | 0.724 | 0.724 |
| compositional_nc | word_by_word | 0.888 | 0.683 | 0.683 |
| compositional_nc | random | 0.641 | 0.147 | 0.147 |
| idiomatic_nc | synonym | 0.763 | 0.250 | 0.250 |
| idiomatic_nc | component | 0.918 | 0.748 | 0.748 |
| idiomatic_nc | word_by_word | 0.837 | 0.555 | 0.555 |
| idiomatic_nc | random | 0.670 | 0.197 | 0.197 |
| ordinary_two_word_control | synonym | 0.865 | 0.715 | 0.715 |
| ordinary_two_word_control | component | 0.891 | 0.788 | 0.788 |
| ordinary_two_word_control | word_by_word | 0.791 | 0.598 | 0.598 |
| ordinary_two_word_control | random | 0.544 | 0.158 | 0.158 |
| single_word_control | synonym | 0.952 | 0.822 | 0.822 |
| single_word_control | related | 0.910 | 0.740 | 0.740 |
| single_word_control | random | 0.749 | 0.314 | 0.314 |

## Synonym - Random Farkı

| group | sentence_gap | contextual_span_gap | isolated_phrase_gap |
|---|---:|---:|---:|
| compositional_nc | 0.254 | 0.578 | 0.578 |
| idiomatic_nc | 0.092 | 0.053 | 0.053 |
| ordinary_two_word_control | 0.320 | 0.557 | 0.557 |
| single_word_control | 0.203 | 0.508 | 0.508 |

## Otomatik Okuma

- Sentence-level ortalama random replacement benzerliği: `0.651`.
- Contextual span ortalama random replacement benzerliği: `0.204`.
- Isolated phrase ortalama random replacement benzerliği: `0.204`.

Okuma ilkesi: random replacement skorları sıradan kontrollerde de yüksek kalıyorsa,
problem yalnızca idiomatiklik değildir; ortak cümle iskeleti, syntactic slot,
contextualization veya modelin yüksek similarity floor'u ölçümü etkiliyor olabilir.
Buna karşılık sıradan kontroller synonym-random ayrımını iyi yaparken idiomatik NC'ler
yapamıyorsa, bu idiomatiklik iddiasını destekler; fakat bu ayrımı göstermek için
ordinary-word / ordinary-phrase kontrolü raporlanmalıdır.
