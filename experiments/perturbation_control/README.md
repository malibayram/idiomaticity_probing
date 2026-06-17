# Perturbation Control Deneyi

Bu küçük kontrol deneyi, He et al. (2025) makalesindeki idiomaticity probing sonucunun
ne kadarının gerçekten idiyomatiklikten, ne kadarının genel embedding/cosine perturbation
duyarsızlığından kaynaklandığını ayırmak için eklendi.

Makaledeki ana test şu biçimdedir:

```text
grey matter -> brain / matter / silvery material / random
```

Burada eksik kalan kontrol şudur:

```text
doctor -> physician / carpet
red car -> crimson vehicle / coffee spoon
```

Yani aynı synonym/random ayrımı, idiomatik olmayan sıradan kelime ve sıradan iki kelimelik
ifadelerde de çalışıyor mu?

## Kapsam

Deney 4 grup içerir:

| group | amaç |
|---|---|
| `idiomatic_nc` | Makaledeki idiyomatik NC davranışını temsil eder: `grey matter`, `eager beaver`. |
| `compositional_nc` | Makaledeki kompozisyonel NC davranışını temsil eder: `economic aid`, `research lab`. |
| `single_word_control` | İdiomatik olmayan tek kelime kontrolü: `doctor`, `apple`, `teacher`. |
| `ordinary_two_word_control` | İdiomatik olmayan iki kelimelik ifade kontrolü: `red car`, `coffee cup`. |

Her satırda üç ölçüm raporlanır:

| ölçüm | neyi karşılaştırır? |
|---|---|
| `sentence_sim` | Orijinal tam cümle embedding'i ile değiştirilmiş tam cümle embedding'i. |
| `contextual_span_sim` | Model tüm cümleyi gördükten sonra sadece hedef span tokenlarının embedding'i. |
| `isolated_phrase_sim` | Hedef ifade ve replacement tek başına encode edildiğinde benzerlik. |

## Çalıştırılan Modeller

| model | neden kullanıldı? | çıktı |
|---|---|---|
| `bert-large-uncased` | Makaledeki İngilizce monolingual BERT ayarına en yakın pratik model: large, uncased. | `bert-large-uncased/results.csv`, `bert-large-uncased/summary.md` |
| `alibayram/embeddingmagibu-200m` | Yerelde cache'te bulunan ek embedding modeli; ana kanıt değil, sanity check. | `results.csv`, `summary.md` |

Komutlar:

```bash
python experiments/perturbation_control/run_control.py \
  --model bert-large-uncased \
  --out experiments/perturbation_control/bert-large-uncased

python experiments/perturbation_control/run_control.py \
  --model alibayram/embeddingmagibu-200m \
  --out experiments/perturbation_control
```

## BERT-large Bulguları

### 1. Sentence-level random replacement genel olarak yüksek kalıyor

`bert-large-uncased` için random replacement ortalamaları:

| group | sentence_sim random |
|---|---:|
| `idiomatic_nc` | 0.901 |
| `compositional_nc` | 0.939 |
| `ordinary_two_word_control` | 0.953 |
| `single_word_control` | 0.943 |

Bu, sentence-level ölçümde yüksek benzerliğin yalnızca idiomatiklikle açıklanamayacağını
gösterir. Tam cümle embedding'i ortak cümle iskeleti tarafından ciddi biçimde taşınıyor.

### 2. Contextual span seviyesinde BERT sıradan kontrolleri daha iyi ayırıyor

`bert-large-uncased` için `synonym`, `random` ve fark değerleri:

| group | synonym contextual_span | random contextual_span | synonym - random farkı |
|---|---:|---:|---:|
| `single_word_control` | 0.912 | 0.627 | 0.285 |
| `ordinary_two_word_control` | 0.879 | 0.626 | 0.252 |
| `compositional_nc` | 0.942 | 0.723 | 0.219 |
| `idiomatic_nc` | 0.761 | 0.671 | 0.089 |

Bu tablo önemli nüansı gösterir: BERT-large sıradan kelime ve sıradan iki kelimelik ifadelerde
synonym'i yüksek, random'ı daha düşük konumlandırabiliyor. En zayıf synonym-random ayrımı
idiyomatik NC grubunda görülüyor.

Dolayısıyla BERT-large sonucu "konunun idiyomatiklikle hiç alakası yok" demiyor. Daha doğru
sonuç şu:

> Sentence-level yüksek benzerlik büyük ölçüde genel ölçüm artefaktı; contextual span seviyesinde
> ise idiyomatik NC'ler gerçekten daha zor görünüyor. Fakat bu ayrımı göstermek için ordinary
> word / ordinary phrase kontrollerinin raporlanması gerekir.

### 3. İdiomatik grupta literal replacement gold synonym'den yüksek çıkabiliyor

BERT-large contextual span ortalamaları:

| idiomatic_nc variant | contextual_span_sim |
|---|---:|
| `word_by_word` | 0.796 |
| `synonym` | 0.761 |
| `random` | 0.671 |
| `component` | 0.650 |

Bu, makalenin ana bulgusuyla uyumlu: model idiyomatik bütüncül synonym'i, literal/word-by-word
alternatiften açıkça daha üstün görmüyor.

## Yazarlarla Tartışılacak Ana Nokta

Makale lexical overlap problemini fark ediyor, sentence-level/NC-level ayrımı yapıyor ve `P_Rand`
ile random baseline kullanıyor. Ancak `P_Rand` sadece NC hedefleri için var. Sistematik olarak
şu kontrol yapılmıyor:

```text
ordinary word: doctor -> physician / carpet
ordinary phrase: red car -> crimson vehicle / coffee spoon
```

Bu kontrol olmadan iki açıklama tam ayrışmıyor:

1. Model gerçekten idiyomatik anlamı temsil etmekte zorlanıyor.
2. Embedding + cosine + shared sentence frame düzeneği genel olarak perturbation farklarını
   yeterince ayırt etmiyor.

BERT-large üzerindeki küçük kontrol, bu ayrımı şöyle inceltiyor:

- Sentence-level için 2. açıklama çok güçlü.
- Contextual span için 1. açıklama daha makul hale geliyor, çünkü ordinary kontroller daha iyi
  ayrışıyor.
- Yine de makalenin iddiası, bu ordinary-control kalibrasyonu raporlanmadan metodolojik olarak
  eksik kalıyor.

En savunulabilir cümle:

> Makale modellerin idiomatik NC problarında beklenen ayrımı göstermediğini ikna edici biçimde
> gösteriyor; ancak başarısızlığın ne kadarının idiyomatikliğe özgü olduğunu göstermek için aynı
> synonym/random perturbation protokolünün idiomatik olmayan ordinary-word ve ordinary-phrase
> kontrollerinde de raporlanması gerekir.
