# Deney 1 - Makalenin Encoder Kohortunu Replikasyon (EN + PT)

## Amaç

He et al. (2025)'in **orijinal bulgusunu** kendi çerçevemizle birebir üretmek: 2024 dönemi
encoder/embedding modelleri isim bileşiklerinin (NC) idiyomatikliğini yakalıyor mu? Bu deney,
geri kalan her şeyin **referans noktasıdır** - yeni modelleri buna göre kıyaslayacağız.

**Kohortlar:** Eski (paper-era): mBERT, DistilBERT-ML, mSBERT · Yeni (2024 modern): XLM-R-large,
BGE-M3, E5-large. İki dil: İngilizce (1124 örnek), Portekizce (720 örnek).

## Veri setinden örnekler (NCIMP)

Her NC, 3 idiyomatiklik sınıfından birine girer ve doğal bir cümlede geçer:

| Sınıf                 | Örnek NC                            | Örnek cümle                                                                  |
| --------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| **İdiyomatik (I)**    | _grey matter_ ("beyin")             | "These youngsters use their **grey matter** when the presentation is right." |
| **İdiyomatik (I)**    | _eager beaver_ ("çalışkan")         | "Eric was being an **eager beaver** and left work late."                     |
| **Kısmi (PC)**        | _Dutch courage_ ("içkiyle cesaret") | "We had to go down to the pub to get some **Dutch courage**."                |
| **Kompozisyonel (C)** | _economic aid_ ("mali yardım")      | "The USSR was soon giving Cuba **economic aid** and military support."       |

Her NC 4 probla değiştirilir: P_Syn (altın eş anlamlı), P_Comp (tek bileşen), P_WordsSyn
(kelime-kelime eş anlamlı), P_Rand (rastgele). Detay: [00_genel_bakis.md](00_genel_bakis.md).

## Beklenen sonuç (örnek cümleyle)

**İdeal bir model şu deseni göstermeli:** P_Syn yüksek (her sınıfta) > P_Comp ≈ P_WordsSyn (yalnız
kompozisyonelde yüksek) > P_Rand düşük.

> Örnek `grey matter`: model "brain"e (P_Syn) yüksek, "matter"/"silvery material"a (P_Comp,
> P_WordsSyn) düşük, "battlefront serviceman"a (P_Rand) en düşük benzerlik vermeli. Çünkü beyin =
> grey matter'ın gerçek anlamı; matter tek başına idiyomatik anlamı taşımaz.

> Örnek `economic aid`: model "financial assistance"a (P_Syn) yüksek vermeli - ve burada P_Comp/
> P_WordsSyn'in de yüksek olması **doğru**, çünkü ifade gerçekten kompozisyonel.

## Gerçek sonuç - örnek cümle üzerinden (BGE-M3, NC düzeyi)

| Prob       | `grey matter` (idiyomatik)                    | `economic aid` (kompozisyonel) |
| ---------- | --------------------------------------------- | ------------------------------ |
| P_Syn      | **0.55** ❌ (beklenen en yüksek, çıktı düşük) | **0.81** ✅ en yüksek          |
| P_Comp     | 0.78 ❌ (Syn'i geçti)                         | 0.73                           |
| P_WordsSyn | 0.64 ❌ (Syn'i geçti)                         | 0.76                           |
| P_Rand     | 0.47 ✅                                       | 0.47 ✅                        |

→ **Kompozisyonelde doğru, idiyomatikte yanlış.** grey matter'da model gerçek anlamı (brain)
parçalardan (matter) daha uzak görüyor - makalenin ana bulgusu.

## Gerçek sonuç - kohort tablosu (kompozit ICS)

**İngilizce (EN):**
| Kohort | ISC↑ | LOD↓ | ICS↑ | Hüküm |
|--------|------|------|------|-------|
| Eski (2024 paper-era) | 0.099 | 0.227 | 0.341 | yakalamıyor |
| Yeni (2024 modern) | 0.174 | 0.077 | **0.430** | yakalamıyor |

EN model bazında: E5-large 0.44 · BGE-M3 0.43 · XLM-R-large 0.42 · mBERT 0.35 · DistilBERT-ML 0.35 · mSBERT 0.32.

**Portekizce (PT):**
| Kohort | ISC↑ | LOD↓ | ICS↑ | Hüküm |
|--------|------|------|------|-------|
| Eski | 0.150 | 0.203 | 0.428 | yakalamıyor |
| Yeni | 0.095 | 0.158 | 0.423 | yakalamıyor |

PT model bazında: BGE-M3 0.45 · mBERT 0.44 · mSBERT 0.43 · DistilBERT-ML 0.42 · E5-large 0.42 · XLM-R-large 0.40.

## Yorum

1. **Makale doğrulandı:** Hiçbir model 0.55 eşiğini geçmiyor; LOD>0 (kompozisyonel önyargı) ve
   AID<0 (yanlış affinity) istisnasız her modelde.
2. **İngilizce'de mütevazı iyileşme** (0.341→0.430, +%26), **Portekizce'de yok** (≈%0). Bu, EN
   kazanımının modellerin İngilizce-ağırlıklı verisinden gelmiş olabileceğini düşündürür.
3. Bu deney **kalibrasyon eksikliği** taşır (bkz. [04_ordinary_kontrol.md](04_ordinary_kontrol.md)):
   yüksek benzerlikler kısmen genel ölçüm artefaktı olabilir - 4. deney bunu ayırır.

**Çıktılar:** `runs/en_all/`, `runs/pt_all/` (REPORT.md, indicators.csv, results.csv, figures/).
