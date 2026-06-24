# Deneyler - Bütüncül Genel Bakış

Bu klasör, yaptığımız **dört deney bloğunu** ayrı ayrı belgeler. Her dosya aynı iskeleti izler:
**amaç → veri örnekleri → beklenen sonuç (örnek cümleyle) → metrikler (örnekle) → gerçek
sonuç tablosu → yorum.**

| #   | Dosya                                                | Deney                                          | Ne sorar?                                                            |
| --- | ---------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- |
| 1   | [01_makale_replikasyon.md](01_makale_replikasyon.md) | He et al. (2025) **encoder kohortu** (EN+PT)   | Makalenin orijinal bulgusunu birebir üretebiliyor muyuz?             |
| 2   | [02_embedding_kohortu.md](02_embedding_kohortu.md)   | **Modern embedding** modelleri (2025-26)       | Yeni SOTA embedding modelleri idiyomatikliği yakalıyor mu?           |
| 3   | [03_llm_kohortu.md](03_llm_kohortu.md)               | **Decoder-only LLM**'ler (Qwen3/3.5, Gemma3/4) | Modern LLM'ler (ölçek+nesil) idiyomatiklikte ilerletti mi?           |
| 4   | [04_ordinary_kontrol.md](04_ordinary_kontrol.md)     | **Ordinary-perturbation kontrolü**             | Başarısızlık idiyomatikliğe mi özgü, yoksa genel ölçüm artefaktı mı? |

---

## 0. Ortak senaryo: tek bir örnek üzerinden tüm fikir

Tüm deneyler şu temel teste dayanır: bir hedef ifadeyi cümle içinde **kontrollü bir ikame** ile
değiştirip, orijinalle **kosinüs benzerliğini** ölçeriz. İyi bir model, anlamı koruyan ikameye
yüksek, korumayana düşük benzerlik vermelidir.

İki zıt örnek (gerçek sonuçlar, **BGE-M3** modeli, NC düzeyi):

**(a) İdiyomatik - `grey matter` ("beyin"):**

> _"These youngsters use their **grey matter** when the presentation is right."_

| İkame (prob) | Ne ile değişti                    | Benzerlik | Beklenen         | Gerçek                       |
| ------------ | --------------------------------- | --------- | ---------------- | ---------------------------- |
| P_Syn        | brain (altın eş anlamlı)          | **0.55**  | en yüksek olmalı | ❌ en düşük (rastgele hariç) |
| P_Comp       | matter (tek bileşen)              | 0.78      | düşük olmalı     | ❌ en yüksek                 |
| P_WordsSyn   | silvery material (kelime-kelime)  | 0.64      | düşük olmalı     | ❌ Syn'den yüksek            |
| P_Rand       | battlefront serviceman (rastgele) | 0.47      | en düşük         | ✅                           |

→ Model "matter"ı (0.78) ve "silvery material"ı (0.64), gerçek anlamı veren "brain"den (0.55)
**daha yakın** buluyor. Yani idiyomu **parçalarının toplamı** sanıyor. **Başarısızlık.**

**(b) Kompozisyonel - `economic aid` ("mali yardım"):**

> _"The USSR was soon giving Cuba **economic aid** and military support."_

| İkame (prob) | Ne ile değişti       | Benzerlik | Beklenen         | Gerçek       |
| ------------ | -------------------- | --------- | ---------------- | ------------ |
| P_Syn        | financial assistance | **0.81**  | en yüksek olmalı | ✅ en yüksek |
| P_Comp       | aid                  | 0.73      | yüksek olabilir  | ✅           |
| P_WordsSyn   | budgetary assistance | 0.76      | yüksek olabilir  | ✅           |
| P_Rand       | rastgele             | 0.47      | en düşük         | ✅           |

→ Burada altın eş anlamlı (0.81) en yüksek - model kompozisyonel ifadeyi **doğru** yakalıyor.

**Bu iki örnek tüm çalışmanın özüdür:** modeller kompozisyonel ifadeleri (economic aid) iyi,
idiyomatik ifadeleri (grey matter) kötü temsil ediyor.

---

## 1. Metrikler - her biri örnekle

Yukarıdaki `grey matter` sayıları (Syn=0.55, Comp=0.78, WordsSyn=0.64, Rand=0.47) üzerinden:

### Sim - ham kosinüs benzerliği

Orijinal ifade ile prob-değiştirilmiş ifade arasındaki kosinüs.

> Örnek: `Sim(P_Syn) = cos(grey matter, brain) = 0.55`.

### Affinity (Aff) - iki prob arasında tercih

`Aff(Pi,Pj) = Sim(Pi) − Sim(Pj)`. Model hangisine daha yakın?

> Örnek: `A_Syn|WordsSyn = Sim(brain) − Sim(silvery material) = 0.55 − 0.64 = −0.09`.
> **Negatif** → model kelime-kelime çeviriyi (silvery material) altın eş anlamlıya (brain)
> **tercih ediyor**. İdeal olan pozitif olmalıydı.

### Scaled Similarity (Sim_R) - rastgele tabana göre ölçekli

`Sim_R(Pi) = (Sim(Pi) − Sim(Rand)) / (1 − Sim(Rand))`. Anizotropiyi düzeltir; 1≈mükemmel, 0≈rastgele.

> Örnek: `Sim_R(Syn) = (0.55 − 0.47) / (1 − 0.47) = 0.15`. Yani altın eş anlamlı, rastgele
> tabanın sadece %15 üstünde - idiyomatik anlam neredeyse hiç yakalanmamış.

### ISC - İdiyomatik Eş Anlamlı Yakalama

İdiyomatik NC'lerde ortalama `Sim_R(Syn)`. Yüksek = iyi.

> Örnek: bir model tüm idiyomatik NC'lerde (grey matter, red tape, …) ortalama Sim_R(Syn)=0.20
> ise ISC=0.20 → altın eş anlamlıları zayıf yakalıyor.

### LOD - Sözcüksel Baskınlık

İdiyomatikte `Sim_R(WordsSyn) − Sim_R(Syn)`. **>0 kötü** (kelime-kelime, bütüncülü yeniyor).

> Örnek: grey matter'da WordsSyn(0.64) > Syn(0.55) → LOD pozitif → kompozisyonel önyargı.

### FLOOR - anizotropi teşhisi

Ortalama `Sim(Rand)`. Yüksekse uzay çökük (her şey benzer görünür).

> Örnek: FLOOR=0.95 → "battlefront serviceman" bile "grey matter"a 0.95 benziyor → uzay çökük.

### ICS - Kompozit Yakalama Skoru ∈[0,1]

Yukarıdakilerin birleşimi. **≥0.70 yakalıyor · ≥0.55 kısmi · <0.55 yakalamıyor.**

### OCG - Ordinary-Calibrated Gap (yalnız 4. deney)

`OCG_idiom = idiyomatik(synonym−random) / sıradan(synonym−random)`. İdiyomatik ayrım, sıradan
kelime/ifadelerin yüzde kaçı kadar?

> Örnek: idiyomatik gap=0.05, sıradan gap=0.13 → OCG=0.38 → idiyomlar sıradanların sadece
> %38'i kadar ayrışıyor.

---

## 2. Master bulgu (dört deney birlikte)

| Deney                  | Kapsam              | Ana sonuç                                                                                                  |
| ---------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1. Encoder replikasyon | 6 model × EN+PT     | Makale doğrulandı: ICS<0.55, idiyomatiklik yakalanmıyor; EN'de modern hafif iyi, PT'de değil               |
| 2. Embedding           | 3 modern model      | En iyi 0.48; yine <0.55                                                                                    |
| 3. LLM                 | 11 model (0.8B-12B) | En iyi base Gemma4-12B **0.525**; yumuşak tavan ~0.50-0.53, hiçbiri 0.55'i geçmiyor                        |
| 4. Ordinary kontrol    | 20 model            | **OCG_idiom hep <1** (max 0.68): idiyomatik ayrım her modelde sıradanlardan zayıf; kompozisyonel ≈ sıradan |

**Tek cümlelik birleşik sonuç:**

> 2024 encoder'lardan 2026 LLM'lerine, 0.8B'den 12B'ye, base'den instruct'a kadar **hiçbir model
> idiyomatikliği yakalama eşiğini geçemiyor**; ordinary kontrol bunun **idiyomatikliğe özgü** bir
> zorluk olduğunu (genel ölçüm artefaktı değil) kanıtlıyor. En yeni base model (Gemma 4 12B) eşiğe
> en çok yaklaşan ama yine de aşamayan modeldir.
