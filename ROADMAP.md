# Yol Haritası (ROADMAP)

*Investigating Idiomaticity in Word Representations* (He et al., 2025) yöntemini
**model-agnostik** bir çerçeveye taşıyıp **yeni modeller** üzerinde tekrar uygulama planı.

Hedef: Makaledeki problar (P_Syn, P_Comp, P_WordsSyn, P_Rand) ve metrikler (Sim, Affinity,
Scaled Similarity, Spearman ρ) sabit kalsın; **modeller takılıp çıkarılabilir** (plug-in) olsun.

Durum işaretleri: ✅ tamam · 🟡 devam ediyor · ⬜ planlandı

---

## Faz 0 — Dokümantasyon ve kurulum
- ✅ Makaleyi indir, oku, yöntemi çıkar (`paper.pdf`)
- ✅ `PAPER_SUMMARY.md` — detaylı Türkçe özet
- ✅ `README.md` — proje tanıtımı, kullanım, yeni model ekleme rehberi
- ✅ `ROADMAP.md` — bu dosya
- ✅ `requirements.txt` — bağımlılıklar
- ⬜ `python -m venv` + `pip install -r requirements.txt` ile ortam kurulumu (kullanıcı)

## Faz 1 — Veri katmanı (`idiomaticity/data.py`)
- ✅ NCIMP CSV şemasını modelle (`original sentence`, `*_tag`, prob sütunları)
- ✅ Orijinal repodan veri indirme scripti (`scripts/download_data.py`)
- ✅ `MinimalPair` / `NCItem` veri sınıfları (cümle + NC span + her prob için ikame)
- ✅ Naturalistic (S1–S3) ve Neutral cümleleri yükleme
- ✅ İnsan `Comp` skorlarını (xlsx) yükleme ve NC'lere bağlama
- ⬜ Veri yoksa çalışabilen küçük **sentetik örnek veri seti** (`data/sample/`) — smoke test için ✅

## Faz 2 — Model-agnostik embedder arayüzü (`idiomaticity/embedders/`)
- ✅ `BaseEmbedder` soyut sınıfı: `embed_span(sentence, span) -> vector`,
  `embed_sentence(sentence) -> vector`
- ✅ `TransformerEmbedder` — herhangi bir HuggingFace modeli (BERT, BERTurk, mBERT, RoBERTa,
  modern encoder'lar), alt-token mean pooling + **son N katman** seçilebilir
- ✅ `StaticEmbedder` — gensim KeyedVectors (Word2Vec/GloVe/fastText)
- ✅ `SentenceEmbedder` — sentence-transformers (yalnız cümle düzeyi)
- ✅ `CausalLMEmbedder` — autoregressive modeller (Llama, Qwen, Mistral) hidden states
- ✅ Model **kayıt defteri (registry)** + YAML/JSON config'ten model kurma
- ⬜ Opsiyonel: API embedder (OpenAI/Cohere) — anahtar varsa

## Faz 3 — Problar ve metrikler (`idiomaticity/probes.py`, `metrics.py`)
- ✅ Prob türlerini ve Dilbilimsel Tahminlerini (LP) enum/sınıf olarak tanımla
- ✅ `cosine_sim`, `Sim(Pi, Target)` (Denklem 2–3)
- ✅ `Affinity` (Denklem 4) + A_Syn|WordsSyn, A_Syn|Rand
- ✅ `ScaledSimilarity` (Denklem 5) + Sim_R|Syn, Sim_R|WordsSyn
- ✅ `spearman_with_comp` (ρ) — ölçüm × insan `Comp`
- ✅ Cümle düzeyi **ve** NC düzeyi ayrı hesap (makaledeki ikili granülerlik)

## Faz 4 — Deney orkestrasyonu (`idiomaticity/experiment.py` + `scripts/run_experiment.py`)
- ✅ Tek bir model × dil × bağlam(Nat/Neut) için tüm problar ve metrikleri hesapla
- ✅ Sonuçları uzun-format `results.csv` + özet `summary.json` olarak yaz
- ✅ Çoklu model karşılaştırması (tek komutla N model)
- ✅ CLI: `--models`, `--lang`, `--context`, `--level`, `--device`, `--limit`
- ✅ Embedding **önbellekleme** (aynı cümle tekrar encode edilmesin)
- ✅ Determinizm: `--seed` ile rastgele prob seçimi sabitlenir

## Faz 5 — Görselleştirme (`scripts/make_plots.py`)
- ✅ Şekil 1 & 2: prob başına benzerlik dağılımı (boxplot), cümle ve NC düzeyi
- ✅ Şekil 5/6/7: Scaled Similarity (Sim_R) dağılımları, idiyomatiklik sınıfına göre
- ✅ Şekil 10 tarzı: modeller arası korelogram
- ✅ "Ideal Values" referans paneli

## Faz 6 — Doğrulama ve testler (`tests/`)
- ✅ Metrik birim testleri (bilinen vektörlerle Sim/Aff/Sim_R doğrulaması)
- ✅ Sentetik veriyle uçtan-uca smoke test (CI'da indirme gerektirmeden)
- ⬜ Orijinal makale değerleriyle 1–2 modelde **sanity check** (kullanıcı verisiyle)

## Faz 7 — Yeni modellerle genişletme (asıl amaç)
Makale 2024 modellerinde durdu. Bu çerçeveyle eklenecek **yeni/farklı modeller**:
- ⬜ Modern encoder'lar: `xlm-roberta-large`, `bge-m3`, `e5-large`, `mGTE`
- ⬜ Türkçe modeller: `dbmdz/bert-base-turkish-cased` (BERTurk), `ytu-ce-cosmos/turkish-*`
- ⬜ Modern LLM hidden states: `Llama-3.x`, `Qwen2.5`, `Mistral`, `Gemma`
- ⬜ Modern embedding modelleri: `text-embedding-3-large`, `Cohere embed v3`
- ⬜ **Türkçe NCIMP** (opsiyonel uzantı): Türkçe isim tamlamaları için minimal çift seti
  oluşturma — makalenin EN/PT desenini Türkçeye taşımak

## Faz 8 — Raporlama
- ⬜ Yeni modellerin sonuçlarını orijinal makale tablolarıyla yan yana koyan
  `REPORT.md` / notebook
- ⬜ "Modern modeller idiyomatikliği daha iyi yakalıyor mu?" sorusuna güncel cevap

---

## Mimarinin özeti

```
NCIMP veri  ─┐
             ├─►  Embedder (plug-in)  ─►  NC & cümle vektörleri  ─┐
problar     ─┘                                                    ├─►  Metrikler  ─►  results.csv ─► grafikler
(P_Syn..Rand)                                                     │   (Sim, Aff, Sim_R, ρ)
insan Comp  ──────────────────────────────────────────────────────┘
```

Yeni model eklemek = `models.yaml`'a bir satır + (gerekiyorsa) yeni bir `BaseEmbedder` alt
sınıfı. Problar ve metrikler hiç değişmez — bu da makaleyi farklı modellerde **adil ve
tekrarlanabilir** biçimde uygulamayı sağlar.
