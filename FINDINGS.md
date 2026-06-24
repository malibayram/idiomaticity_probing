# Bulgular - Modern modeller idiyomatiklikte gelişti mi?

> Ana soru: _Bu sürede her alanda gelişen yapay zeka modelleri idiyomatiklik temsilinde de
> gelişti mi? Gelişti ise ne kadar? Gelişmedi ise temel sorun ne?_
> Yöntem: He et al. (2025) NCIMP probları + Affinity/Scaled Similarity, **NC düzeyinde**.
> Kohortlar - Eski (paper-era): mBERT, DistilBERT-ML, mSBERT · Yeni (modern): XLM-R-large,
> BGE-M3, E5-large. Hepsi çok dilli; aynı reçete (son 4 katman, alt-token ortalaması).

---

## Kısa cevap

1. **Gelişti mi?** Kısmen ve **dile bağlı.** İngilizce'de yeni kohort eski kohortu her ana
   göstergede doğru yönde geçti; Portekizce'de ise **esasen değişim yok**.
2. **Ne kadar?** İngilizce'de mütevazı: kompozit **ICS 0.34 → 0.43 (+26%)**. Portekizce'de
   **≈ %0** (0.43 → 0.42). Ama **hiçbir model, hiçbir dilde** "kısmi yakalama" eşiğini (0.55)
   bile geçemedi; 12 koşunun hepsi _"idiyomatikliği yakalamıyor"_ hükmünü aldı.
3. **Temel sorun?** **Yapısal kompozisyonel önyargı.** Modeller idiyomu hâlâ parçalarının
   toplamı olarak kodluyor (LOD>0, **tüm modeller & diller**) ve doğru bütüncül eş anlamlıyı
   tercih etmiyor (AID<0, **istisnasız**). Üstelik **anizotropi yeni büyük modellerde daha
   kötü** (FLOOR; XLM-R-large EN 0.93 / PT 0.95). İyileşmenin yalnız İngilizce'de görülmesi,
   kazanımın idiyomatikliği "kavramaktan" değil İngilizce-ağırlıklı eğitim verisinden gelmiş
   olabileceğini düşündürüyor. → RESEARCH_DESIGN'daki **H0 (yapısal darboğaz)** güçlü biçimde
   doğrulanıyor: ölçek artışı sorunu kökten çözmüyor.

---

## EN sonuçları (1124 instance, NC düzeyi)

### Eski vs Yeni kohort

| Gösterge                                | Eski   | Yeni   | Δ             | İyileşti?        |
| --------------------------------------- | ------ | ------ | ------------- | ---------------- |
| **ICS** (kompozit, ↑)                   | 0.341  | 0.430  | +0.089 (+26%) | ✅               |
| ISC (idiyomatik eş anlamlı yakalama, ↑) | 0.099  | 0.174  | +0.075        | ✅               |
| IG (idiyomatiklik açığı C−I, ↓)         | 0.446  | 0.348  | −0.098        | ✅               |
| LOD (sözcüksel baskınlık, ↓; <0 ideal)  | 0.227  | 0.077  | −0.150        | ✅ (ama hâlâ >0) |
| AID (idiyomda affinity, ↑; >0 ideal)    | −0.108 | −0.021 | +0.087        | ✅ (ama hâlâ <0) |
| FLOOR (anizotropi proxy, teşhis)        | 0.575  | 0.723  | +0.148        | ❌ kötüleşti     |
| RHO (ρ(Sim_R\|Syn, Comp), ↓)            | 0.615  | 0.578  | −0.037        | ✅               |

### Model bazında ICS (hepsi 0.55 eşiğinin altında)

| Model         | Kohort | mean ICS | Hüküm       |
| ------------- | ------ | -------- | ----------- |
| E5-large      | yeni   | 0.44     | yakalamıyor |
| BGE-M3        | yeni   | 0.43     | yakalamıyor |
| XLM-R-large   | yeni   | 0.42     | yakalamıyor |
| mBERT         | eski   | 0.35     | yakalamıyor |
| DistilBERT-ML | eski   | 0.35     | yakalamıyor |
| mSBERT        | eski   | 0.32     | yakalamıyor |

### Sınıf bazında Sim_R|Syn (merdiven deseni sürüyor)

mBERT örneği: idiyomatik (I) ≈ 0.09 · kısmi (PC) ≈ 0.31 · kompozisyonel (C) ≈ 0.55.
İdeal modelde üç değer de ≈1 ve düz olmalıydı. Yeni modeller idiyomatik ucu biraz yukarı
çekiyor (ISC 0.10→0.17) ama açık (IG) hâlâ büyük.

### Dikkat çeken aykırı: mSBERT

En düşük anizotropiye sahip (FLOOR=0.21, iyi ayrışmış uzay) ama **en kötü** kompozisyonel
önyargı (LOD=0.29) ve affinity (AID=−0.23). → İzotropik bir uzay tek başına idiyomatikliği
çözmüyor; sorun uzayın geometrisi değil, **neyin kodlandığı**.

**Çıktılar:** `runs/en_all/` → `REPORT.md`, `indicators.csv`, `results.csv`, `summary.json`,
`figures/` (ics_by_model, indicators_grid, simR_by_class, similarity_nc, scaled_nc,
scaled_by_class_nc).

---

## PT sonuçları (Portekizce, 720 instance, NC düzeyi)

**Önemli:** EN'deki iyileşme Portekizce'ye **taşınmadı.**

### Eski vs Yeni kohort (PT)

| Gösterge              | Eski   | Yeni   | Δ      | İyileşti?             |
| --------------------- | ------ | ------ | ------ | --------------------- |
| **ICS** (kompozit, ↑) | 0.428  | 0.423  | −0.005 | ❌ esasen değişim yok |
| ISC (↑)               | 0.150  | 0.095  | −0.055 | ❌ geriledi           |
| IG (↓)                | 0.304  | 0.328  | +0.024 | ❌                    |
| LOD (↓; <0 ideal)     | 0.203  | 0.158  | −0.045 | ✅ (ama hâlâ >0)      |
| AID (↑; >0 ideal)     | −0.085 | −0.026 | +0.059 | ✅ (ama hâlâ <0)      |
| FLOOR (teşhis)        | 0.608  | 0.730  | +0.122 | ❌ kötüleşti          |
| RHO (↓)               | 0.421  | 0.492  | +0.072 | ❌                    |

### Model bazında ICS (PT) - hepsi yine 0.55 eşiğinin altında

| Model         | Kohort | mean ICS | Hüküm       |
| ------------- | ------ | -------- | ----------- |
| BGE-M3        | yeni   | 0.45     | yakalamıyor |
| mBERT         | eski   | 0.44     | yakalamıyor |
| mSBERT        | eski   | 0.43     | yakalamıyor |
| DistilBERT-ML | eski   | 0.42     | yakalamıyor |
| E5-large      | yeni   | 0.42     | yakalamıyor |
| XLM-R-large   | yeni   | 0.40     | yakalamıyor |

PT'de eski modeller zaten ~0.43'teydi (EN'deki 0.34'ten yüksek) ve yeni modeller bunu
**iyileştiremedi** - hatta XLM-R-large/E5 hafifçe geriledi. LOD>0 ve AID<0 yine **tüm
modellerde** geçerli; FLOOR yeni büyük modellerde yine daha yüksek (XLM-R-large 0.95).

**Çıktılar:** `runs/pt_all/` → `REPORT.md`, `indicators.csv`, `results.csv`, `summary.json`,
`figures/`.

---

## Birleşik hüküm (EN + PT)

|          | EN       | PT       |
| -------- | -------- | -------- |
| Eski ICS | 0.34     | 0.43     |
| Yeni ICS | 0.43     | 0.42     |
| Δ        | **+26%** | **≈ %0** |

İki dil birlikte okunduğunda tablo netleşiyor:

1. **Gelişme dile bağlı ve kırılgan.** İngilizce'de gerçek bir iyileşme var; Portekizce'de **yok**.
   Bu, EN'deki kazanımın büyük ölçüde modern modellerin **İngilizce-ağırlıklı eğitim verisinden**
   gelmiş olabileceğini, idiyomatikliği gerçekten "kavramaktan" değil, düşündürüyor.
2. **Hiçbir model, hiçbir dilde idiyomatikliği yakalamıyor.** Her 12 model×dil koşusunda hüküm
   aynı: _"yakalamıyor"_ (ICS hep < 0.55).
3. **Başarısızlık imzaları evrensel:** LOD>0 (kompozisyonel önyargı) ve AID<0 (yanlış affinity)
   **istisnasız** her modelde, her dilde. En büyük encoder'lar (XLM-R-large) en anizotropik
   uzayları kuruyor (FLOOR ~0.93–0.95).

→ **H0 (yapısal darboğaz) güçlü biçimde doğrulanıyor.** Ölçek/mimari ilerlemesi idiyomatiklik
temsiline kökten yansımıyor; PT'de hiç yansımıyor. Bu, sorunun bir **kapasite** değil bir
**temsil önyargısı** (ifadeyi parçalarının toplamı olarak kodlama) olduğu tezini destekliyor.

---

## Yorum (araştırma sorusu bağlamında)

- **H1 (ölçek hipotezi) kısmen doğrulandı:** Daha yeni/büyük modeller gerçekten daha iyi -
  ilerleme reel ve yön tutarlı.
- **H0 (yapısal darboğaz) baskın çıkıyor:** İyileşme yüzeysel kalıyor; idiyomatik anlamı
  "anlamak" yerine modeller hâlâ sözcüksel kompozisyona yaslanıyor (LOD>0, AID<0 her modelde).
  Hatta en büyük encoder (XLM-R-large) en anizotropik uzayı kuruyor.
- **Pratik sonuç:** İdiyomatikliği gerçekten yakalamak için muhtemelen ölçek değil, **paradigma
  değişikliği** gerekiyor (örn. idiyom-farkında ön-eğitim hedefleri, adapter/curriculum
  yaklaşımları, anti-anizotropi düzeltmeleri). Bu, makalenin sonuç bölümüyle uyumlu ama artık
  2025–2026 modelleriyle de gösterilmiş oluyor.

---

## Sınırlılıklar

- ICS sezgisel bir kompozit; mutlak gerçek değil, **kohort karşılaştırması** için. Asıl kanıt
  tekil göstergeler (LOD, AID, IG) ve dağılımlar.
- E5/BGE gibi modeller "query:"/"passage:" önekleri olmadan ham metinle gömüldü (kontrollü
  kıyas için tutarlılık tercih edildi); önekli bir varyant ileride denenebilir.
- Yalnız EN/PT (NCIMP kapsamı). Türkçe için ayrı minimal-çift seti gerekir (ROADMAP Faz 7).
- Decoder-only modern LLM'ler (Qwen/Llama-3) bu hafif kohorta dahil değil; ayrı bir koşu konusu.
