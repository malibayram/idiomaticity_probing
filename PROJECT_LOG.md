# Proje Kaydı (PROJECT LOG)

Bu dosya, projenin **baştan sona ne yaptığımızın ve ne sonuç aldığımızın** tek noktadan ayrıntılı
kaydıdır. Diğer dokümanlar konuya göre derinleşir; burası kronolojik/bütünsel özettir.

**Son güncelleme:** 2026-06-17 · **Durum:** Encoder kohortu (EN+PT) tamam · Decoder-only LLM
kohortu (Qwen3 / Gemma 4) indiriliyor.

---

## 0. Amaç ve ana soru

He et al. (2025), *Investigating Idiomaticity in Word Representations* (Computational
Linguistics 51(2)) makalesinin yöntemini **model-agnostik** bir çerçeveye taşıyıp, makalenin
durduğu 2024 modellerinin ötesinde **modern modellerde** tekrar uygulamak.

> **Araştırma sorusu:** Bu sürede her alanda gelişen yapay zeka modelleri idiyomatiklik
> temsilinde de gelişti mi? Gelişti ise ne kadar? Gelişmedi ise temel sorun ne?

### Doküman haritası
| Dosya | İçerik |
|-------|--------|
| [PAPER_SUMMARY.md](PAPER_SUMMARY.md) | Makalenin detaylı Türkçe yöntem özeti (NCIMP, problar, metrikler) |
| [RESEARCH_DESIGN.md](RESEARCH_DESIGN.md) | Soruyu ölçülebilir göstergelere/hipotezlere çeviren deney tasarımı |
| [FINDINGS.md](FINDINGS.md) | Encoder kohortu (EN+PT) bulguları ve birleşik hüküm |
| [README.md](README.md) | Kurulum, kullanım, yeni model ekleme |
| [ROADMAP.md](ROADMAP.md) | Fazlara bölünmüş yol haritası |
| **PROJECT_LOG.md** (bu dosya) | Bütünsel kayıt + tüm sonuçlar |

---

## 1. Ne inşa ettik? (kronolojik)

1. **Makale analizi.** `paper.pdf` (51 sayfa) indirildi; yöntem, NCIMP veri formatı, problar,
   metrikler ve modeller çıkarıldı.
2. **Dokümantasyon:** PAPER_SUMMARY, RESEARCH_DESIGN, README, ROADMAP.
3. **Model-agnostik çerçeve** (`idiomaticity/` paketi):
   - `embedders/` — `BaseEmbedder` + registry; pluggable backend'ler:
     `transformer` (BERT/XLM-R/BERTurk), `causal` (Llama/Qwen), `sentence` (SBERT/BGE/E5),
     `multimodal_causal` (Gemma 4 metin yolu), `static` (Word2Vec/GloVe), `mock` (bağımsız test).
   - `data.py` — NCIMP CSV adaptörü + kanonik JSON + insan `Comp` skorları.
   - `probes.py` — P_Syn / P_Comp / P_WordsSyn / P_Rand tanımları + Dilbilimsel Tahminler.
   - `metrics.py` — Sim (Eq.2-3), Affinity (Eq.4), Scaled Similarity (Eq.5), Spearman ρ.
   - `experiment.py` — pipeline (cache'li, cümle + NC düzeyi).
   - `analysis.py` — iyileşme göstergeleri (ISC/IG/LOD/AID/FLOOR/RHO), kompozit ICS, teşhis,
     eski-vs-yeni kohort karşılaştırması.
4. **Scriptler** (`scripts/`): `download_data.py`, `run_experiment.py`, `analyze.py`,
   `make_plots.py`, `compare_models.py`, `make_sample_data.py`, `run_cohort.sh`.
5. **Gerçek NCIMP verisi** indirildi ve adaptör **gerçek formata** göre düzeltildi
   (list-literal `[True,False]` tag'leri, BOM, çoğul/tekil kanonik eşleme, NC=idiyomatik→I).
6. **Encoder/embedding kohortu (EN+PT) koşuldu** — 6 model × 2 dil. (Bölüm 4)
7. **Decoder-only LLM kohortu başlatıldı** — Qwen3 base merdiveni + Gemma 4 adaptörü. (Bölüm 5)

---

## 2. Yöntem özeti (kısa)

Her isim bileşiği (NC) cümle içinde 4 probla değiştirilir; orijinalle kosinüs benzerliği ölçülür.
- **P_Syn** = altın bütüncül eş anlamlı (yüksek beklenir) · **P_Comp** = tek bileşen ·
  **P_WordsSyn** = kelime-kelime eş anlamlı · **P_Rand** = frekans-eşli rastgele (düşük/taban).
- **Metrikler:** Sim (ham kosinüs), Affinity (`Sim(Pi)−Sim(Pj)`), Scaled Similarity
  (`(Sim(Pi)−Sim(Rand))/(1−Sim(Rand))`), insan `Comp` ile Spearman ρ.
- **İyileşme göstergeleri** (NC düzeyi, idiyomatik sınıf): `ISC`↑, `IG`↓, `LOD`↓(<0 ideal),
  `AID`↑(>0 ideal), `FLOOR` (anizotropi teşhisi), `RHO`↓, ve kompozit `ICS∈[0,1]`↑.
  Hükümler: ICS≥0.70 "yakalıyor", ≥0.55 "kısmi", <0.55 "yakalamıyor".

---

## 3. Veri (doğrulanmış)

`scripts/download_data.py` ile orijinal repodan indirildi (`data/ncimp/`, 10/10 dosya):
- EN: `naturalistics_examplesent{1,2,3}.csv` + `neutral.csv` → **1124 instance**, 1116'sı skorlu.
- PT: aynı yapı → **720 instance**, 720'si skorlu.
- `human_compositionality scores.xlsx` → type-level `Comp` skoru (0=idiyomatik..5=kompozisyonel)
  ve sınıf (`NC`→I, `PC`, `C`).
- **4 prob %100 kapsama**, spanlar doğru (tag-tabanlı, doğrulandı).

---

## 4. SONUÇLAR — Encoder/embedding kohortu (TAMAMLANDI)

**Kohortlar:** Eski (paper-era): mBERT, DistilBERT-ML, mSBERT · Yeni (modern): XLM-R-large,
BGE-M3, E5-large. Hepsi çok dilli; NC düzeyi; naturalistic+neutral bağlam.
Çıktılar: `runs/en_all/`, `runs/pt_all/` (+ `runs/en_mbert/` ilk pilot).

### 4.1 İngilizce (EN) — eski vs yeni
| Gösterge | Eski | Yeni | Δ | İyileşti? |
|----------|------|------|---|-----------|
| **ICS** (↑) | 0.341 | 0.430 | +0.089 (**+26%**) | ✅ |
| ISC (↑) | 0.099 | 0.174 | +0.075 | ✅ |
| IG (↓) | 0.446 | 0.348 | −0.098 | ✅ |
| LOD (↓; <0 ideal) | 0.227 | 0.077 | −0.150 | ✅ (hâlâ >0) |
| AID (↑; >0 ideal) | −0.108 | −0.021 | +0.087 | ✅ (hâlâ <0) |
| FLOOR (teşhis) | 0.575 | 0.723 | +0.148 | ❌ kötüleşti |
| RHO (↓) | 0.615 | 0.578 | −0.037 | ✅ |

**EN model bazında ICS:** E5-large 0.44 · BGE-M3 0.43 · XLM-R-large 0.42 · mBERT 0.35 ·
DistilBERT-ML 0.35 · mSBERT 0.32 → **hepsi <0.55, "yakalamıyor".**
**Hüküm:** Mütevazı iyileşme (+26%), ama idiyomatiklik hâlâ çözülmedi.

### 4.2 Portekizce (PT) — eski vs yeni
| Gösterge | Eski | Yeni | Δ | İyileşti? |
|----------|------|------|---|-----------|
| **ICS** (↑) | 0.428 | 0.423 | −0.005 (**≈%0**) | ❌ |
| ISC (↑) | 0.150 | 0.095 | −0.055 | ❌ geriledi |
| IG (↓) | 0.304 | 0.328 | +0.024 | ❌ |
| LOD (↓) | 0.203 | 0.158 | −0.045 | ✅ (hâlâ >0) |
| AID (↑) | −0.085 | −0.026 | +0.059 | ✅ (hâlâ <0) |
| FLOOR | 0.608 | 0.730 | +0.122 | ❌ |
| RHO (↓) | 0.421 | 0.492 | +0.072 | ❌ |

**PT model bazında ICS:** BGE-M3 0.45 · mBERT 0.44 · mSBERT 0.43 · DistilBERT-ML 0.42 ·
E5-large 0.42 · XLM-R-large 0.40 → **hepsi <0.55, "yakalamıyor".**
**Hüküm:** Esasen değişim yok.

### 4.3 Birleşik hüküm (EN + PT)
| | EN | PT |
|--|----|----|
| Eski ICS | 0.34 | 0.43 |
| Yeni ICS | 0.43 | 0.42 |
| Δ | **+26%** | **≈ %0** |

1. **Gelişme dile bağlı ve kırılgan:** İngilizce'de gerçek iyileşme var, Portekizce'de yok →
   kazanım büyük ölçüde modern modellerin **İngilizce-ağırlıklı verisinden** geliyor olabilir.
2. **Hiçbir model, hiçbir dilde idiyomatikliği yakalamıyor** (12 koşunun hepsi ICS<0.55).
3. **Başarısızlık imzaları evrensel:** LOD>0 (kompozisyonel önyargı) ve AID<0 (yanlış affinity)
   istisnasız her modelde, her dilde. En büyük encoder (XLM-R-large) en anizotropik (FLOOR ~0.93–0.95).
4. → **H0 (yapısal darboğaz) güçlü biçimde doğrulanıyor:** ölçek/mimari ilerlemesi idiyomatikliği
   kökten çözmüyor; sorun kapasite değil **temsil önyargısı** (ifadeyi parçalarının toplamı sayma).

### 4.4 mBERT pilotu (ilk gerçek koşu, EN)
mBERT naturalistic: ISC 0.087 · IG 0.493 · LOD 0.213 · FLOOR 0.779 · RHO 0.676 · **ICS 0.332**.
Beş başarısızlık imzasının tamamını gösterdi; He et al. (2025)'in mBERT bulgusunu birebir üretti.
`Sim_R|Syn` sınıf merdiveni: idiyomatik 0.09 · kısmi 0.31 · kompozisyonel 0.55.

---

## 5. DEVAM EDEN — Decoder-only LLM kohortu (<15B, base/PT)

Seçim gerekçesi (RESEARCH_DESIGN'la uyumlu): **IT değil base** kullanıyoruz (temsil-probing için
hizalama geometriyi kirletir). Sınır 15B. 64GB M2 Max → bellek sorun değil.

| Model | hf_id | Tip | Durum |
|-------|-------|-----|-------|
| Qwen3-4B-Base | Qwen/Qwen3-4B-Base | causal | İndiriliyor (doğrulama, EN limitli) |
| **Qwen3-14B-Base** | Qwen/Qwen3-14B-Base | causal | **İndiriliyor (asıl koşu, EN nat+neut)** |
| Qwen3-8B-Base | Qwen/Qwen3-8B-Base | causal | models.yaml'da hazır (sırada) |
| Gemma4-12B-Base | google/gemma-4-12B | multimodal_causal | Adaptör hazır; Qwen sonrası |
| Gemma4-E4B-Base | google/gemma-4-E4B | multimodal_causal | Adaptör hazır |

- **Qwen3** modelleri `Qwen3ForCausalLM`, Apache-2.0, ungated → mevcut `causal` embedder ile çalışır.
- **Gemma 4** `Gemma4(Unified)ForConditionalGeneration` (multimodal) → yeni `multimodal_causal`
  embedder yazıldı: görüntü/ses girişi olmadan metin omurgasından gizli-katman çıkarır. Gerçek
  yükleme API'si 12B indiğinde doğrulanacak (gerekirse transformers upgrade / ufak düzeltme).
- **Benchmark notu:** Gemma 4 12B (2026) genel benchmark'larda Qwen3-14B'yi (2025) muhtemelen
  hafif geçiyor; ama leaderboard skoru bizim probe sonucumuzu zayıf öngörüyor (XLM-R örneği).

**Sonuçlar geldiğinde** `analyze.py`/`compare_models.py` ile encoder kohortuyla yan yana
konacak; FINDINGS.md ve bu dosya güncellenecek.

### 5.1 Modern SOTA embedding modelleri (eklendi, koşu bekliyor)
`models.yaml`'a `type: sentence` olarak eklendi (hepsi ungated, doğrulandı):
`Qwen3-Emb-0.6B/4B/8B`, `mE5-large-instruct`, `gte-Qwen2-1.5B/7B-instruct` (trust_remote_code),
`llama-embed-nemotron-8b` (⚠️ non-commercial lisans), `NV-Embed-v2` (custom code, trust_remote_code),
`bge-en-icl` (EN odaklı). `SentenceEmbedder` artık `trust_remote_code` + `dtype` destekliyor.

**Metodolojik etiket (önemli):** Bunlar **sentence-embedding** modelleridir. Çerçevede:
- `--level sentence` → tam cümle embedding'i (makalenin cümle düzeyi).
- `--level nc` → **izole-ifade** embedding'i (span metnini tek başına encode eder).
- **Contextual token span DEĞİL** (BERT/XLM-R/Qwen hidden-state'in aksine). Sonuçlar bu etiketle
  raporlanmalı; bu modeller cümle düzeyi + sıradan-pertürbasyon kontrolü için çok değerli.

**API modelleri** (gemini-embedding-2, voyage-4-large, cohere embed-v4.0, text-embedding-3-large):
ayrı bir `api` embedder + anahtar gerektirir; yaml'da yorum olarak not edildi, ileride eklenecek.

---

## 6. Dosya envanteri

```
semeval2022/
├── paper.pdf
├── PAPER_SUMMARY.md · RESEARCH_DESIGN.md · FINDINGS.md · README.md · ROADMAP.md · PROJECT_LOG.md
├── requirements.txt · models.yaml
├── idiomaticity/
│   ├── data.py · probes.py · metrics.py · experiment.py · analysis.py
│   └── embedders/ base.py · transformer.py · causal.py · multimodal.py · sentence.py · static.py · mock.py
├── scripts/
│   ├── download_data.py · run_experiment.py · analyze.py · make_plots.py
│   └── compare_models.py · make_sample_data.py · run_cohort.sh
├── data/ sample/ (sentetik) · ncimp/ (gerçek, indirildi)
├── tests/ test_metrics.py   (8/8 geçiyor)
└── runs/ en_all/ · pt_all/ · en_mbert/ · (qwen14_en/ … geliyor)
```

---

## 7. Yeniden üretim (reproduction)

```bash
pip install -r requirements.txt
python scripts/download_data.py --out data/ncimp

# Encoder kohortu (EN+PT) — TAMAMLANMIŞ sonuçları yeniden üretir:
bash scripts/run_cohort.sh          # DEVICE=mps varsayılan

# Decoder-only LLM (base, <15B):
HF_TOKEN=<token> python scripts/run_experiment.py --models models.yaml \
  --select Qwen3-14B-Base --data data/ncimp --lang EN \
  --context naturalistic neutral --level nc --device mps --out runs/qwen14_en
python scripts/analyze.py --results runs/qwen14_en/results.csv --out runs/qwen14_en --level nc
```

---

## 8. Ortam ve sağlama (provenance)

- Donanım: Apple M2 Max, 64 GB RAM (MPS).
- Python 3.13; torch 2.10, transformers 5.8.1, sentence-transformers 5.2.2.
- Veri kaynağı: github.com/risehnhew/Finding-Idiomaticity-in-Word-Representations (orijinal NCIMP).
- HF token yalnızca çalışma anında env değişkeni olarak kullanıldı; **hiçbir dosyaya yazılmadı**.
  ⚠️ Token sohbette paylaşıldığı için iş bitince **revoke/yenile** önerilir.

---

## 9. Açık işler / sıradaki adımlar
- [ ] Qwen3-14B-Base EN koşusu bitince analiz + rapor; sonra PT.
- [ ] Qwen3-8B-Base ve Qwen3-4B-Base ile base merdivenini tamamla (4B→8B→14B ölçekleme eğrisi).
- [ ] Gemma 4 12B'yi `multimodal_causal` ile koştur (yükleme API doğrulaması).
- [ ] LLM sonuçlarını encoder kohortuyla tek tabloda birleştir (cross-architecture).
- [ ] Opsiyonel: IT vs base ikinci ekseni; `sentence` düzeyi koşusu; Türkçe NCIMP uzantısı.

---

## 10. Değişiklik özeti (changelog)
- **v0.1** Çerçeve + dokümanlar + gerçek veri doğrulama + sentetik smoke test.
- **v0.2** Encoder/embedding kohortu (6 model × EN+PT) koşuldu; analiz/teşhis/grafik; FINDINGS.
- **v0.3** Decoder-only LLM desteği: `causal` + yeni `multimodal_causal` embedder; Qwen3 base
  merdiveni + Gemma 4 girişleri; LLM koşuları başlatıldı *(devam ediyor)*.
- **v0.4** Modern SOTA embedding modelleri eklendi (Qwen3-Embedding, gte-Qwen2, mE5-instruct,
  NV-Embed-v2, llama-embed-nemotron, bge-en-icl); `SentenceEmbedder`'a `trust_remote_code`+`dtype`;
  sentence-level vs izole-ifade vs contextual-span metodolojik etiketi belgelendi.
