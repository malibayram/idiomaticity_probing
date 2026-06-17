# Idiomaticity Probing — Model-Agnostik Çerçeve

He et al. (2025), *Investigating Idiomaticity in Word Representations* (Computational
Linguistics 51(2)) makalesinin yöntemini **herhangi bir kelime temsil modelinde** tekrar
uygulamak için kurulmuş bir çerçeve.

Makale; isim bileşiklerinin (noun compounds) idiyomatikliğinin modeller tarafından ne kadar
yakalandığını **minimal çiftler** ve **model-agnostik metrikler** (Affinity, Scaled Similarity)
ile ölçer. Bu repo aynı problar ve metrikleri sabit tutup **modelleri takılıp-çıkarılabilir**
hale getirir — böylece makalenin durduğu 2024 modellerinin ötesinde **modern LLM'ler, çok
dilli embedding modelleri ve Türkçe modeller** üzerinde de aynı deney koşturulabilir.

📄 Detaylı yöntem özeti: [PAPER_SUMMARY.md](PAPER_SUMMARY.md)
🧪 Ana araştırma sorusu ve deney tasarımı: [RESEARCH_DESIGN.md](RESEARCH_DESIGN.md)
📊 **Bulgular (EN+PT, 6 model çalıştırıldı):** [FINDINGS.md](FINDINGS.md)
📓 **Bütünsel proje kaydı + tüm sonuçlar:** [PROJECT_LOG.md](PROJECT_LOG.md)
🗺️ Geliştirme planı: [ROADMAP.md](ROADMAP.md)

> **Bu çalışmanın ana sorusu:** Bu sürede her alanda gelişen yapay zeka modelleri,
> *idiyomatiklik temsili* alanında da gelişti mi — gelişti ise ne kadar, gelişmedi ise temel
> sorun ne? Cevabı `scripts/analyze.py` üretir (eski vs yeni model kohortları + teşhis).

---

## Ne ölçülüyor? (1 dakikada)

Makalenin ana sorusu şudur: Bir temsil modeli, *grey matter* gibi bir isim bileşiğini sadece
`grey + matter` kelimelerinin toplamı olarak mı görüyor, yoksa ifadenin bütüncül anlamını
(*brain*) yakalayabiliyor mu?

Deney bunu doğrudan sınıflandırma olarak sormaz. Bunun yerine her hedef isim bileşiği
(**NC**, noun compound) için küçük **minimal çiftler** üretir:

1. Orijinal cümle ya da hedef NC parçası vektöre dönüştürülür.
2. Aynı cümlede NC, kontrollü bir **prob** ifadesiyle değiştirilir.
3. Orijinal temsil ile prob-değiştirilmiş temsil arasındaki kosinüs benzerliği ölçülür.
4. Bu benzerlikler, insanların verdiği kompozisyonelite skoru (**Comp**) ile karşılaştırılır.

`Comp` skoru bu repoda `comp_score` alanıdır: 0'a yakın değerler daha idiyomatik, 5'e yakın
değerler daha kompozisyoneldir.

### Vektör ve kosinüs sezgisi

Model, her metni tek bir etikete çevirmek yerine çok boyutlu bir sayı listesine, yani
**vektöre**, çevirir:

```text
"These youngsters use their grey matter ..."
        -> [0.20, -0.50, 0.80, 0.10, ...]

"These youngsters use their brain ..."
        -> [0.19, -0.48, 0.82, 0.12, ...]
```

Bu sayıları "cümlenin ruh hali" gibi düşünmek sezgisel olarak yararlı olabilir, ama teknik
olarak her boyutu tek tek "mantıklı mı?", "somut mu?", "hareket var mı?" diye okumayız.
Embedding boyutları genellikle insan tarafından adlandırılabilir özellikler değildir; anlam,
bütün vektörün uzaydaki konumunda kodlanır.

Benzerlik için **kosinüs benzerliği** kullanılır. Bu ölçü iki vektörün uzunluğundan çok
aralarındaki yöne/açıya bakar:

```text
Orijinal vektör ile P_Syn vektörü   -> küçük açı -> yüksek kosinüs
Orijinal vektör ile P_Rand vektörü  -> büyük açı -> düşük kosinüs
```

Kosinüs benzerliği matematiksel olarak `[-1, 1]` aralığındadır: `1` aynı yön, `0` dik/ilişkisiz
yön, `-1` ters yön demektir. Pratikte birçok embedding uzayında değerler çoğunlukla pozitif
görünebilir; bu yüzden `P_Rand` kontrolü ve `Sim_R` ölçeklemesi önemlidir.

Kod düzeyindeki karşılığı:

```python
from idiomaticity.metrics import cosine_sim

vec_original = model.embed("These youngsters use their grey matter ...")
vec_syn = model.embed("These youngsters use their brain ...")
vec_rand = model.embed("These youngsters use their battlefront serviceman ...")

similarity_syn = cosine_sim(vec_original, vec_syn)    # örn. 0.95
similarity_rand = cosine_sim(vec_original, vec_rand)  # örn. 0.10
```

Bu sayılar temsili örnektir; gerçek değerler kullanılan modele, bağlama ve `level` seçimine
(`sentence` veya `nc`) göre değişir.

### Problar

| Prob | İkame | Beklenti |
|------|-------|----------|
| **P_Syn** | NC'nin altın/bütüncül eş anlamlısı | Her sınıfta yüksek benzerlik |
| **P_Comp** | Anlamı en çok koruyan tek bileşen; pratikte head, yoksa modifier | Kompozisyonelde yüksek, idiyomatikte düşük |
| **P_WordsSyn** | Bileşenlerin kelime-kelime eş anlamlısı | Kompozisyonelde yüksek, idiyomatikte düşük |
| **P_Rand** | Frekans-eşli rastgele gerçek ifadeler; genelde 5 örnek | Her sınıfta düşük benzerlik, alt sınır/kontrol |

Önemli ayrım: `P_Rand` uydurma ya da anlamsız token değildir; veri setinden gelen, hedefle
semantik ilişkisi olmayan frekans-eşli gerçek ifadelerdir. Bu yüzden modelin "her şeye yüksek
benzerlik verme" eğilimini görünür kılan bir taban çizgi gibi kullanılır.

### Somut örnek: idiyomatik NC

Örnek hedef ifade: *grey matter* (`Comp` düşük, idiyomatik). Orijinal cümle:

> These youngsters use their **grey matter** when the presentation is right.

| Prob | Değişmiş cümle | İdeal yorum |
|------|----------------|-------------|
| **P_Syn** | These youngsters use their **brain** when the presentation is right. | Bütüncül anlam korunur; benzerlik yüksek olmalı. |
| **P_Comp** | These youngsters use their **matter** when the presentation is right. | Tek bileşen idiyomatik anlamı taşımaz; benzerlik düşmeli. |
| **P_WordsSyn** | These youngsters use their **silvery material** when the presentation is right. | Kelime-kelime anlam beyin anlamını vermez; benzerlik düşmeli. |
| **P_Rand** | These youngsters use their **battlefront serviceman** when the presentation is right. | Semantik ilişki yok; benzerlik en düşük bölgede olmalı. |

Temsili bir ideal çıktı şöyle olabilir:

| Ölçüm | Değer | Yorum |
|-------|-------|-------|
| `Sim(P_Syn)` | 0.95 | Altın eş anlamlı orijinale çok yakın. |
| `Sim(P_Comp)` | 0.40 | Tek bileşen anlamı korumuyor. |
| `Sim(P_WordsSyn)` | 0.35 | Kelime-kelime eş anlamlı idiyomatik anlamı kaçırıyor. |
| `Sim(P_Rand)` | 0.10 | Rastgele kontrol alt sınırda. |

Bu tek örnek sadece sezgiyi gösterir. Asıl karar, tüm NC'lerde ölçümlerin insan `Comp`
skoruyla beklenen yönde sıralanıp sıralanmadığına bakılarak verilir.

### Kompozisyonel karşı örnek

*economic aid* gibi kompozisyonel bir NC'de tablo farklı olmalıdır:

> The USSR was soon giving Cuba **economic aid** and military support.

- **P_Syn:** *financial assistance* — yüksek benzerlik beklenir.
- **P_Comp:** *aid* — anlamın önemli kısmını koruduğu için yüksek/orta-yüksek olabilir.
- **P_WordsSyn:** *budgetary assistance* — kelime-kelime değişim hâlâ yakın kalabilir.
- **P_Rand:** *random walk* veya *kitchen table* — düşük kalmalıdır.

Yani idiyomatik ifadelerde `P_Comp` ve `P_WordsSyn` düşerken, kompozisyonel ifadelerde bu
probların orijinale daha yakın kalması beklenir. `P_Syn` ise her iki durumda da yüksek
kalmalıdır; çünkü bütüncül eş anlamlı zaten hedef anlamı korur.

### Metrikler nasıl ayrışıyor?

| Metrik | Kod çıktısı | Ne sorar? |
|--------|-------------|-----------|
| **Sim** | `sim_P_Syn`, `sim_P_Comp`, `sim_P_WordsSyn`, `sim_P_Rand` | Prob-değiştirilmiş temsil orijinale ham olarak ne kadar yakın? |
| **Affinity** | `aff_Syn|WordsSyn`, `aff_Syn|Rand` | Model iki probdan hangisini orijinale daha yakın buluyor? Formül: `Sim(Pi) - Sim(Pj)`. |
| **Scaled Similarity** | `simR_Syn`, `simR_WordsSyn` | Benzerlik, `P_Rand` alt sınırına göre ne kadar anlamlı? Formül: `(Sim(Pi) - Sim(P_Rand)) / (1 - Sim(P_Rand))`. |
| **Spearman ρ** | `summary.json` içinde `spearman_comp` | Ölçüm değerleri ile insan `Comp` sıralaması ne kadar uyumlu? |

Örnek sayılarla:

```text
Sim(P_Syn)      = 0.95
Sim(P_WordsSyn) = 0.35
Sim(P_Rand)     = 0.10

Affinity(Syn, WordsSyn) = 0.95 - 0.35 = 0.60
Sim_R(Syn)              = (0.95 - 0.10) / (1 - 0.10) = 0.94
Sim_R(WordsSyn)         = (0.35 - 0.10) / (1 - 0.10) = 0.28
```

`Sim` ham yakınlığı verir; `Affinity` iki alternatif arasındaki tercihi gösterir; `Sim_R` ise
rastgele kontrolün üstünde gerçekten ne kadar sinyal kaldığını ölçer. Son aşamada bu ölçümlerin
NC başına ortalaması alınır ve insan `Comp` skoruyla Spearman korelasyonuna sokulur.

### Ek metodolojik kontrol: ordinary perturbation

Makaledeki önemli açık soru şudur: yüksek benzerlikler gerçekten idiyomatikliği yakalayamama
probleminden mi geliyor, yoksa embedding + cosine + aynı cümle iskeleti düzeneği genel olarak
kelime değişimlerine duyarsız mı?

Bunu kontrol etmek için küçük bir ek deney eklendi:

📁 [experiments/perturbation_control](experiments/perturbation_control)

Bu deney, makaledeki `grey matter -> brain / silvery material / random` mantığını sıradan
idiomatik olmayan örneklere de uygular:

```text
doctor -> physician / carpet
red car -> crimson vehicle / coffee spoon
```

Makaledeki güçlü BERT ayarına yakın bir model olarak `bert-large-uncased` indirildi ve aynı
kontrolle çalıştırıldı. BERT-large için en açıklayıcı tablo, `contextual_span_sim` değerlerini
yan yana göstermektir:

| group | synonym `contextual_span_sim` | random `contextual_span_sim` | `synonym - random` farkı |
|---|---:|---:|---:|
| `idiomatic_nc` | 0.761 | 0.671 | 0.089 |
| `compositional_nc` | 0.942 | 0.723 | 0.219 |
| `ordinary_two_word_control` | 0.879 | 0.626 | 0.252 |
| `single_word_control` | 0.912 | 0.627 | 0.285 |

Ek olarak, sentence-level random benzerlikler sıradan kontrollerde de yüksek kalıyor:

| group | random `sentence_sim` |
|---|---:|
| `idiomatic_nc` | 0.901 |
| `compositional_nc` | 0.939 |
| `ordinary_two_word_control` | 0.953 |
| `single_word_control` | 0.943 |

Okuma: sentence-level random similarity sıradan kontrollerde de çok yüksek; bu yüzden tam cümle
embedding'i ortak cümle iskeletinden ciddi biçimde etkileniyor. Contextual span seviyesinde ise
BERT-large sıradan kontrollerde synonym/random ayrımını daha iyi yapıyor: synonym skorları
yüksek, random skorları daha düşük, fark da belirgin. En zayıf synonym-random farkı idiyomatik
NC'lerde kalıyor. Bu sonuç makaleyi tamamen geçersiz kılmaz; fakat ordinary-word /
ordinary-phrase kalibrasyonu raporlanmadan "başarısızlık idiyomatikliğe özgüdür" iddiası eksik
kalır.

---

## Kurulum

```bash
cd /Users/alibayram/Desktop/semeval2022
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

> Minimum çekirdek için yalnızca `numpy`, `scipy`, `pandas` yeter (metrikler + sentetik veri).
> Transformer/static/sentence embedder'lar için `torch`, `transformers`, `gensim`,
> `sentence-transformers` gerekir (requirements.txt'te opsiyonel olarak işaretli).

---

## Veriyi getir

NCIMP veri seti orijinal repodadır. İndirmek için:

```bash
python scripts/download_data.py --out data/ncimp
```

İndirme yapılamıyorsa çerçeve, `data/sample/` altındaki **sentetik mini veriyle** çalışır
(smoke test için yeterli, gerçek sonuç vermez).

---

## Çalıştırma

Tek model, İngilizce, naturalistic bağlam, NC düzeyi:

```bash
python scripts/run_experiment.py \
  --models bert-base-multilingual-cased \
  --lang EN --context naturalistic --level nc \
  --data data/ncimp --out runs/mbert
```

Birden çok modeli karşılaştır (makale + modern modeller):

```bash
python scripts/run_experiment.py \
  --models models.yaml \
  --lang EN --context naturalistic neutral --level nc sentence \
  --out runs/compare
```

Araştırma sorusunu cevapla (eski vs yeni kohort + "temel sorun" teşhisi → `REPORT.md`):

```bash
python scripts/analyze.py --results runs/compare/results.csv --out runs/compare --level nc \
  --old mBERT DistilBERT-ML mSBERT \
  --new XLM-R-large BGE-M3 E5-large Qwen2.5-7B
```

Grafikleri üret:

```bash
python scripts/make_plots.py --results runs/compare/results.csv --out runs/compare/figures
```

Çıktılar:
- `results.csv` — uzun format: `model, lang, context, level, nc, comp_class, probe, sim, ...`
- `summary.json` — model × ölçüm özet tablosu (Affinity, Sim_R, Spearman ρ)
- `indicators.csv` + `REPORT.md` — gelişme göstergeleri ve hüküm ([RESEARCH_DESIGN.md](RESEARCH_DESIGN.md))
- `figures/` — Şekil 1/2/5/10 tarzı grafikler

---

## Yeni model ekleme (asıl amaç)

İki yol var:

### 1) Var olan bir embedder tipini kullan — sadece config
`models.yaml`'a bir giriş ekle:

```yaml
models:
  # Türkçe encoder
  - name: berturk
    type: transformer
    hf_id: dbmdz/bert-base-turkish-cased
    last_n_layers: 4

  # Modern çok dilli embedding modeli
  - name: bge-m3
    type: sentence
    hf_id: BAAI/bge-m3

  # Modern LLM (hidden states)
  - name: qwen2.5-7b
    type: causal
    hf_id: Qwen/Qwen2.5-7B
    last_n_layers: 4
    dtype: bfloat16
```

`type` ∈ `{static, transformer, sentence, causal}` mevcut embedder'lara eşlenir. Başka kod
gerekmez.

### 2) Tamamen yeni bir embedder yaz
`idiomaticity/embedders/base.py` içindeki `BaseEmbedder`'dan türet ve iki metodu uygula:

```python
from idiomaticity.embedders.base import BaseEmbedder, register

@register("my_api")
class MyApiEmbedder(BaseEmbedder):
    def embed_sentence(self, sentence: str) -> "np.ndarray":
        ...
    def embed_span(self, sentence: str, span: tuple[int, int]) -> "np.ndarray":
        # span = NC'nin kelime indeksleri; cümle düzeyi modellerde
        # embed_sentence'a düşülebilir
        ...
```

Problar ve metrikler değişmediği için yeni model **otomatik olarak** tüm deneye katılır.

---

## Proje yapısı

```
semeval2022/
├── paper.pdf                  # orijinal makale
├── PAPER_SUMMARY.md           # Türkçe detaylı özet
├── README.md / ROADMAP.md
├── requirements.txt
├── models.yaml                # model kayıt defteri (config)
├── idiomaticity/              # ana paket
│   ├── data.py                # NCIMP loader + veri sınıfları
│   ├── probes.py              # P_Syn..P_Rand tanımları
│   ├── metrics.py             # Sim, Affinity, ScaledSim, Spearman
│   ├── experiment.py          # pipeline orkestrasyonu
│   └── embedders/             # model-agnostik embedder'lar
│       ├── base.py            # BaseEmbedder + registry
│       ├── static.py
│       ├── transformer.py
│       ├── sentence.py
│       └── causal.py
├── scripts/
│   ├── download_data.py
│   ├── run_experiment.py
│   └── make_plots.py
├── data/
│   └── sample/                # sentetik mini veri (smoke test)
└── tests/
    └── test_metrics.py
```

---

## Atıf

```bibtex
@article{he2025idiomaticity,
  title   = {Investigating Idiomaticity in Word Representations},
  author  = {He, Wei and Vieira, Tiago Kramer and Garcia, Marcos and
             Scarton, Carolina and Idiart, Marco and Villavicencio, Aline},
  journal = {Computational Linguistics},
  volume  = {51}, number = {2}, pages = {505--555}, year = {2025},
  doi     = {10.1162/coli_a_00546}
}
```

Orijinal kod: https://github.com/risehnhew/Finding-Idiomaticity-in-Word-Representations
