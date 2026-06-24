# Araştırma Tasarımı

## Ana Soru

> Bu geçen sürede birçok alanda ciddi şekilde gelişen yapay zeka modelleri **idiyomatiklik
> temsili** alanında da gelişme sağladı mı? Sağladılarsa **ne kadar**? Sağlamadılarsa buradaki
> **temel sorun** ne olabilir?

He et al. (2025), 2024 dönemi modellerinin (BERT ailesi, ELMo, Llama2, OpenAI ada-002, statik
embeddingler) idiyomatik anlamı **doğru temsil etmediğini** gösterdi. Bu çalışma aynı kontrollü
deneyi (NCIMP minimal çiftleri + Affinity/Scaled Similarity metrikleri) **2024–2026 dönemi
modern modellerde** tekrar koşturarak yukarıdaki üç alt-sorunun her birine **sayısal** cevap
verir. Yöntem sabit, modeller değişken → "zaman içindeki ilerleme"yi adil ölçeriz.

---

## Hipotezler

- **H1 (İyimser / scaling hipotezi):** Modern modeller çok daha büyük veri ve parametreyle
  eğitildi; idiyomatiklik de bir "dünya bilgisi" olduğundan, bu modeller idiyomatik eş
  anlamlılığı daha iyi yakalar. → ISC↑, IG↓, LOD<0, ICS↑.
- **H0 (Yapısal darboğaz hipotezi):** İdiyomatiklik bir kapasite değil **temsil önyargısı**
  sorunudur; modeller ifadeyi hâlâ bileşenlerinin toplamı olarak kodlar. Ölçek artışı bunu
  düzeltmez. → Göstergeler 2024'e benzer kalır; özellikle LOD>0 (sözcüksel baskınlık) sürer.

Çalışma, H1 ile H0 arasında **karar veren** göstergeler tasarlar.

---

## Operasyonelleştirme - "Gelişme" nasıl ölçülür?

İdeal, idiyomatikliği gerçekten yakalayan bir modelin göstermesi gerekenler ve bizim
ölçütlerimiz (hepsi **NC düzeyinde**, idiyomatik sınıfta - `idiomaticity/analysis.py`):

| Gösterge  | Tanım                                                             | İdeal             | Makale (2024)           | "Gelişme" yönü      |
| --------- | ----------------------------------------------------------------- | ----------------- | ----------------------- | ------------------- |
| **ISC**   | İdiyomatik NC'lerde ort. `Sim_R\|Syn`                             | ≈1                | düşük, çok değişken     | ↑                   |
| **IG**    | `Sim_R\|Syn(C) − Sim_R\|Syn(I)` (idiyomatiklik açığı)             | ≈0                | büyük pozitif           | ↓ (0'a)             |
| **LOD**   | İdiyomatikte `Sim_R\|WordsSyn − Sim_R\|Syn` (sözcüksel baskınlık) | <0                | >0                      | ↓                   |
| **AID**   | İdiyomatikte `A_Syn\|WordsSyn` affinity                           | >0                | ≤0                      | ↑                   |
| **RHO**   | `ρ(Sim_R\|Syn, Comp)`                                             | ≈0 (yassı-yüksek) | orta pozitif (~0.4–0.6) | \|·\|↓              |
| **FLOOR** | NC düzeyinde ort. `Sim(P_Rand)`                                   | düşük             | yüksek                  | teşhis (anizotropi) |
| **ICS**   | Yukarıdakilerin kompoziti ∈[0,1]                                  | →1                | düşük                   | ↑                   |

**"Ne kadar gelişti?"** → `cohort_comparison`: eski (makale) kohortu vs yeni (modern) kohortun
ortalama göstergeleri ve yön-duyarlı Δ + göreli % değişim (özellikle ICS üzerinden).

---

## "Temel sorun" teşhisi - gelişmediyse neden?

Göstergeler sorunu **lokalize eder** (`analysis.diagnose`):

1. **Kompozisyonel önyargı (LOD>0):** İdiyomda kelime-kelime düz çeviri, bütüncül altın eş
   anlamlıdan daha yüksek benzerlik veriyorsa → model idiyomu hâlâ parçalarının toplamı sayıyor.
   _Bu, makalenin işaret ettiği temel başarısızlık imzasıdır._
2. **Anizotropi / yüzey-biçim baskınlığı (FLOOR yüksek):** Rastgele ikameler bile benzer
   görünüyorsa → vektör uzayı dar bir koniye sıkışmış; benzerlik anlamı değil yüzeyi yansıtıyor.
3. **Bağlamın kullanılmaması (Nat ≈ Neut):** Bilgilendirici doğal bağlam, nötr bağlama göre
   `Sim_R|Syn`'i iyileştirmiyorsa → model dikkat mekanizmasına rağmen idiyomatik ipucunu
   bağlamdan çıkaramıyor.
4. **Sadece kompozisyonelde çalışma (RHO yüksek):** Eş anlamlı geri-getirme yalnızca
   kompozisyonel NC'lerde işliyor.

Bu dördü H0'ı (yapısal darboğaz) destekler; ISC↑ ve IG↓ ile birlikte düşük LOD ise H1'i destekler.

---

## Deney Tasarımı

**Sabitler (makaleyle birebir):** NCIMP veri seti, 4 prob (P_Syn/P_Comp/P_WordsSyn/P_Rand),
embedding reçetesi (alt-token ortalaması, transformer'larda son 4 katman), kosinüs benzerliği,
iki granülerlik (cümle + NC), iki bağlam (naturalistic + neutral), Spearman ρ.

**Değişken:** model.

### Kohortlar

| Kohort                              | Modeller                                                    | `type`                             |
| ----------------------------------- | ----------------------------------------------------------- | ---------------------------------- |
| **Eski (referans, makale)**         | Word2Vec, GloVe, ELMo, mBERT, DistilBERT-ML, mSBERT, Llama2 | static/transformer/sentence/causal |
| **Yeni (modern encoder/embedding)** | XLM-R-large, BGE-M3, multilingual-E5-large, GTE, mGTE       | transformer/sentence               |
| **Yeni (modern LLM)**               | Llama-3.1/3.3, Qwen2.5, Mistral, Gemma-2                    | causal                             |
| **Uzantı (Türkçe)**                 | BERTurk, ytu-ce-cosmos/Turkish-\*                           | transformer                        |

Eski kohortta mümkünse makaledeki **tam modelleri** çalıştırıp bizim metriklerle yeniden
üretmek, "elma-elma" karşılaştırması için tercih edilir (makale tablolarına da bakılabilir).

### Diller

- **Birincil:** EN + PT (makaleyle doğrudan kıyas).
- **Uzantı:** TR (Türkçe isim tamlamaları için ayrı minimal-çift seti gerekir - ROADMAP Faz 7).

### Akış

```
download_data.py → run_experiment.py (eski+yeni modeller) → results.csv
       → analyze.py (indicators.csv + REPORT.md) → make_plots.py (figürler)
```

---

## Karar Kuralı (Bottom line)

`analyze.py` ICS-Δ'ya göre otomatik hüküm verir:

- **Δ_ICS > 0.10** → "anlamlı gelişme" (H1 lehine).
- **0.03 < Δ_ICS ≤ 0.10** → "mütevazı gelişme; sorun çözülmedi".
- **|Δ_ICS| ≤ 0.03** → "esasen değişim yok → darboğaz ölçek değil, yapısal" (H0 lehine).
- **Δ_ICS < −0.03** → "modern modeller daha iyi değil".

Hüküm her zaman, hangi göstergenin neden katkı verdiğini (teşhis listesi) ile birlikte raporlanır.

---

## Sınırlılıklar

- ICS bir **sezgisel kompozit**tir; mutlak gerçek değil, kohortlar arası **sıralama/karşılaştırma**
  için tasarlandı. Asıl kanıt tekil göstergeler (ISC, IG, LOD) ve dağılımlardır.
- Decoder-only modellerde span temsili nedensel (yalnız sol bağlam); makale Llama2'yi de aynı
  reçeteyle işlediğinden kıyas adil kalır ama mimari farkı akılda tutulmalı.
- NCIMP yalnız EN/PT'dedir; "modern modeller geliştir mi" sorusu bu iki dille sınırlıdır -
  Türkçe yanıtı ayrı veri seti gerektirir.
