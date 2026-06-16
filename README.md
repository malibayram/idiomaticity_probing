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
🗺️ Geliştirme planı: [ROADMAP.md](ROADMAP.md)

---

## Ne ölçülüyor? (1 dakikada)

Bir hedef isim bileşiği (NC, örn. *grey matter* = "beyin") cümle içinde 4 farklı **prob** ile
değiştirilir ve orijinaliyle kosinüs benzerliği ölçülür:

| Prob | İkame | Beklenti |
|------|-------|----------|
| **P_Syn** | NC'nin altın eş anlamlısı (*brain*) | benzerlik **yüksek** olmalı |
| **P_Comp** | NC'nin tek bileşeni (*matter*) | kompozisyonelde yüksek, idiyomatikte düşük |
| **P_WordsSyn** | kelime-kelime eş anlamlı (*silvery material*) | idiyomatikte düşük olmalı |
| **P_Rand** | frekans-eşli rastgele ifade | benzerlik **düşük** olmalı (alt sınır) |

Sonra üç metrik hesaplanır:
- **Sim** — ham kosinüs benzerliği.
- **Affinity** — model NC'yi altın eş anlamlıya mı yoksa kelime-kelime/rastgeleye mi daha
  yakın buluyor? (`Sim(P_Syn) − Sim(P_other)`)
- **Scaled Similarity (Sim_R)** — rastgele alt sınıra göre yeniden ölçeklenmiş benzerlik
  (anizotropik uzaylarda yüksek benzerlik aldatmacasını giderir).

Her metrik insanın **kompozisyonelite** etiketiyle (`Comp`) Spearman korelasyonuna sokulur.

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

Grafikleri üret:

```bash
python scripts/make_plots.py --results runs/compare/results.csv --out runs/compare/figures
```

Çıktılar:
- `results.csv` — uzun format: `model, lang, context, level, nc, comp_class, probe, sim, ...`
- `summary.json` — model × ölçüm özet tablosu (Affinity, Sim_R, Spearman ρ)
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
