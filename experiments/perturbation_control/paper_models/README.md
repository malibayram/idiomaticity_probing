# Paper Models on Perturbation Controls

Bu klasör, makaledeki modellerden yerelde çalıştırılabilenleri bizim genişletilmiş kontrol setimizde ölçer.
Kontrol seti 64 örnek içerir: 16 idiomatic NC, 16 compositional NC, 16 ordinary two-word control, 16 single-word control.

Not: mSBERT sentence-transformers tipi pooled embedding modelidir; gerçek contextual token-span vermez. Bu yüzden mSBERT için `contextual_span_sim`, hedef ifadenin ayrı encode edilmiş span/phrase benzerliği olarak yorumlanmalıdır.

## Çalıştırılan Modeller

| model | paper karşılığı | çıktı |
|---|---|---|
| BERT-large-EN | yerel paper modeli | `BERT-large-EN/results.csv` |
| mBERT | yerel paper modeli | `mBERT/results.csv` |
| DistilBERT-ML | yerel paper modeli | `DistilBERT-ML/results.csv` |
| mSBERT | yerel paper modeli | `mSBERT/results.csv` |

## Synonym - Random Farkı

Pozitif fark, modelin synonym replacementı random replacementtan daha benzer gördüğünü gösterir. Idiomatic NC grubunda bu farkın ordinary kontrollerden daha küçük kalması, idiomatik ifadelerde ayrımın zayıfladığını gösterir.

| model | group | sentence_gap | contextual_span_gap | isolated_phrase_gap |
|---|---|---:|---:|---:|
| BERT-large-EN | compositional_nc | 0.044 | 0.214 | 0.179 |
| BERT-large-EN | idiomatic_nc | 0.025 | 0.088 | -0.024 |
| BERT-large-EN | ordinary_two_word_control | 0.048 | 0.206 | 0.128 |
| BERT-large-EN | single_word_control | 0.037 | 0.259 | 0.107 |
| DistilBERT-ML | compositional_nc | 0.023 | 0.152 | 0.147 |
| DistilBERT-ML | idiomatic_nc | 0.002 | -0.011 | -0.002 |
| DistilBERT-ML | ordinary_two_word_control | 0.023 | 0.094 | 0.089 |
| DistilBERT-ML | single_word_control | 0.021 | 0.136 | 0.096 |
| mBERT | compositional_nc | 0.027 | 0.123 | 0.103 |
| mBERT | idiomatic_nc | 0.000 | -0.012 | 0.002 |
| mBERT | ordinary_two_word_control | 0.030 | 0.105 | 0.061 |
| mBERT | single_word_control | 0.028 | 0.143 | 0.074 |
| mSBERT | compositional_nc | 0.254 | 0.578 | 0.578 |
| mSBERT | idiomatic_nc | 0.092 | 0.053 | 0.053 |
| mSBERT | ordinary_two_word_control | 0.320 | 0.557 | 0.557 |
| mSBERT | single_word_control | 0.203 | 0.508 | 0.508 |

## Random Benzerlik Zemini

Bu tablo random replacementların bile cümle düzeyinde ne kadar yüksek kaldığını gösterir.

| model | random sentence mean | random contextual/span mean | random isolated mean |
|---|---:|---:|---:|
| BERT-large-EN | 0.936 | 0.676 | 0.691 |
| DistilBERT-ML | 0.963 | 0.739 | 0.739 |
| mBERT | 0.955 | 0.791 | 0.813 |
| mSBERT | 0.651 | 0.204 | 0.204 |

## Şimdilik Eksik Paper Modelleri

- Word2Vec ve GloVe: yerelde uygun `.bin/.vec/.txt` embedding dosyası bulunamadı.
- ELMo: bu repo için ELMo embedder uygulanmış değil ve yerel ELMo ağırlığı bulunmadı.
- Llama2-13B: HuggingFace cache içinde bulunamadı.
- OpenAI `text-embedding-ada-002`: kapalı API modeli; yerel model olmadığı için bu offline kontrolde çalıştırılmadı.
