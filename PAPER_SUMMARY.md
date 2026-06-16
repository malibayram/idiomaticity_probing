# Makale Özeti — *Investigating Idiomaticity in Word Representations*

> He, W., Vieira, T. K., Garcia, M., Scarton, C., Idiart, M., & Villavicencio, A. (2025).
> **Investigating Idiomaticity in Word Representations.** *Computational Linguistics*, 51(2), 505–555.
> https://doi.org/10.1162/coli_a_00546 · [PDF](paper.pdf) · [Orijinal kod](https://github.com/risehnhew/Finding-Idiomaticity-in-Word-Representations)

Bu dosya, makalenin yöntemini **yeni modeller üzerinde birebir tekrar uygulayabilmek** için
gereken tüm kavramları derler. Sonuçlardan çok "ne yapıldı ve nasıl ölçüldü" kısmına odaklanır.

---

## 1. Problem ve Amaç

**İdiyomatik ifadeler** (örn. *eager beaver* = "çok çalışkan kişi") anlamları bileşen
kelimelerinden doğrudan türetilemeyen çok-kelimeli ifadelerdir (MWE). Soru şudur:

> Kelime temsil modelleri (statik + bağlamsal/Transformer) idiyomatikliği gerçekten
> yakalıyor mu, yoksa yüzeysel sözcüksel benzerliğe mi dayanıyor?

Makale, **iki dilde** (İngilizce ve Portekizce) **isim bileşikleri** (noun compounds, NC)
üzerinde, farklı idiyomatiklik seviyelerini içeren **minimal çiftler** kullanarak bu soruyu
araştırır. Üç araştırma sorusu:

- **Q1** — İdiyomatiklik kelime temsil modelleri tarafından ne ölçüde yakalanıyor?
- **Q2** — Bu yetenek NC'nin idiyomatiklik derecesinden, bağlamın bilgilendiriciliğinden
  ve dilden nasıl etkileniyor?
- **Q3** — Bağlamsal (Transformer) modeller statik modellerden daha mı iyi?

**Ana sonuç:** Yüksek kosinüs benzerlikleri ilk bakışta "modeller idiyomatikliği yakalıyor"
izlenimi verse de, kontrollü ölçümler (Affinity, Scaled Similarity) bunun **yanıltıcı**
olduğunu gösterir. Bağlamsal modeller bile idiyomatik anlamı henüz doğru temsil etmiyor;
büyük autoregressive modeller (Llama2) çoğu zaman statik modellere benziyor.

---

## 2. NCIMP Veri Seti (Noun Compound Idiomaticity Minimal Pairs)

Toplam **32.200 cümle**: İngilizce 280 NC (19.600 cümle), Portekizce 180 NC (12.600 cümle).
Her NC üç idiyomatiklik sınıfından birine girer:

| Sınıf | Açıklama | Örnek | EN sayısı | PT sayısı |
|-------|----------|-------|-----------|-----------|
| **Idiomatic (I)** | Anlam iki kelimeyle de ilgisiz | *eager beaver*, *grey matter* | 103 | 60 |
| **Partly compositional (PC)** | Anlam kelimelerden biriyle ilgili | *grandfather clock*, *Dutch courage* | 88 | 60 |
| **Compositional (C)** | Anlam iki kelimeyle de ilgili | *research project*, *economic aid* | 89 | 60 |

### Bağlam (cümle) türleri
- **Naturalistic (Nat):** NC'yi aynı anlamda örnekleyen, korpustan alınmış **3 doğal cümle**
  (her NC için S1, S2, S3). Uzun ve bilgilendirici (EN ort. 23.4 kelime, PT 13.0).
- **Neutral (Neut):** Bilgi vermeyen 5 kelimelik kalıp — EN: *"This is a/an &lt;NC&gt;"*,
  PT: *"Este/a é um(a) &lt;NC&gt;"*. Modelin "varsayılan/ön-eğitim" eğilimini ölçer.

### İnsan etiketleri (altın standart)
Her NC, her cümlede **0 (tamamen idiyomatik) – 5 (tamamen kompozisyonel)** Likert ölçeğiyle
etiketlenmiş. NC başına kompozisyonelite skoru:

```
Comp(NC_α) = ⟨ ⟨ Comp_αβj ⟩_Annot ⟩_Sent      (Denklem 1)
```
yani önce anotörler üzerinden, sonra cümleler üzerinden ortalama. Bu skor `Comp` ile
gösterilir ve tüm korelasyon analizlerinde altın standart olarak kullanılır.

---

## 3. Problar (Minimal Çift Üretimi)

Her cümlede hedef NC, sistematik olarak bir **prob (P)** ile değiştirilerek minimal çift
oluşturulur. Her probun beklenen anlam değişimi = **Dilbilimsel Tahmin (Linguistic Prediction, LP)**.

| Prob | Ne ile değiştirilir | Örnek (NC = *crocodile tears*) | Beklenen benzerlik (LP) |
|------|---------------------|--------------------------------|--------------------------|
| **P_Syn** | NC'nin altın eş anlamlısı (bütüncül) | → *fake tears* / *brain* (grey matter için) | **Yüksek** — her zaman, idiyomatiklikten bağımsız |
| **P_Comp** | NC'nin anlamı en çok koruyan tek bileşeni (baş veya niteleyici) | → *tears* veya *crocodile* | Kompozisyonel NC'lerde yüksek, idiyomatikte düşük (`Comp` ile korelasyon) |
| **P_WordsSyn** | Her bileşenin bağlamdan-bağımsız eş anlamlısı (kelime-kelime) | → *alligator sobs* | Kompozisyonelde yüksek, idiyomatikte düşük (`Comp` ile **yüksek** korelasyon) |
| **P_Rand** | Frekansı eşlenmiş rastgele iki-kelimelik ifade (5 örnek) | → *supermarket city* | **Düşük** — her zaman (alt sınır/kontrol) |

İdeal (beklenen) benzerlik deseni: **P_Syn yüksek > P_Comp ≈ P_WordsSyn orta > P_Rand düşük.**
Makalenin temel bulgusu: gerçek modeller bu kademeli deseni göstermez.

> Veri seti CSV sütunları (orijinal repo formatı): `original sentence`, `original sentence_tag`,
> `synonym for compound` (+`_tag`), `original head only`, `original modifier only`,
> `synonym both` (+`_tag`), `nc rand freq sentence1`..`5` (+`_tag`). `_tag` sütunları,
> cümle içinde NC/prob tokenlarının konumunu işaretleyen ikili maskelerdir.

---

## 4. Temsil (Embedding) Çıkarımı

Hem **cümle** hem **NC** temsilleri, ilgili tokenların (alt-kelime) embeddinglerinin
**ortalaması** alınarak üretilir (mean pooling). Model tipine göre:

- **Statik (Word2Vec, GloVe, fastText):** kelime vektörleri doğrudan sözlükten; OOV kelimeler
  atlanır.
- **ELMo:** çıkış kelime embeddingleri ortalanır, **üç katman concat** edilir.
- **Transformer (BERT, mBERT, DistilBERT, vb.):** alt-token temsilleri ortalanır,
  **son 4 katman** kullanılır.
- **Sentence-BERT / API embeddings (OpenAI):** doğrudan cümle embeddingi (NC-düzeyi inceleme
  gerektirdiğinden OpenAI yalnızca cümle düzeyinde kullanılır).

**Premisler:** (1) vektörler anlamı yaklaşık temsil eder; (2) kelime/cümle anlamı bileşenlerin
**toplamsal** (additive: ortalama) birleşimidir; (3) anlam benzerliği **kosinüs benzerliği**
ile ölçülür.

---

## 5. Metrikler

### 5.1 Similarity (Sim) — kosinüs
```
cossim(X, Y) = (e_X · e_Y) / (||e_X|| ||e_Y||)                       (Denklem 2)
Sim(Pi, Target) = ⟨ cossim(expr(Pi), expr(NC)) ⟩_Pi                  (Denklem 3)
```
Orijinal ifade ile prob-değiştirilmiş ifade arasındaki ortalama kosinüs. P_Rand için 5 ikame
üzerinden ortalama; diğerleri tek ikame.

### 5.2 Affinity (Aff) — karşılaştırmalı tercih
```
Aff(Pi, Pj | Target) = Sim(Pi, Target) − Sim(Pj, Target)            (Denklem 4)
```
Hedefin, iki prob arasında hangisine **daha yakın** olduğunu ölçer. +1'e yakın → Pi tercih
edilir, −1'e yakın → Pj, 0 → tercih yok. Zorunlu-seçim (forced-choice) testlerinin sürekli
genellemesidir. İki kilit affinity:
- **A_Syn|WordsSyn = Aff(P_Syn, P_WordsSyn | NC)** — NC altın eş anlamlısına mı yoksa
  kelime-kelime eş anlamlısına mı daha yakın?
- **A_Syn|Rand = Aff(P_Syn, P_Rand | NC)** — NC altın eş anlamlısına rastgeleye göre daha mı yakın?

### 5.3 Scaled Similarity (Sim_R) — yeniden ölçeklenmiş benzerlik
Anizotropik uzaylarda rastgele iki embedding bile yüksek benzerlik verebilir; bu yüzden
rastgele alt sınıra göre yeniden ölçekleme (max-min normalizasyonuna eşdeğer):
```
Sim_R(Pi | Target) = ⟨ (Sim(Pi,T) − Sim(P_Rand,T)) / (1 − Sim(P_Rand,T)) ⟩_Sent   (Denklem 5)
```
- `Sim_R ≈ 1` → prob neredeyse mükemmel (P_Syn için beklenir).
- `Sim_R ≈ 0` → prob rastgele kadar kötü.
İki kilit ölçüm: **Sim_R|Syn** (≈1 beklenir) ve **Sim_R|WordsSyn** (idiyomatikte ≈0 beklenir).

### 5.4 Correlation (ρ) — Spearman
Her ölçüm (Sim, Aff, Sim_R) ile insan `Comp` skoru arasında **Spearman korelasyonu**.
Beklenti: P_Syn ve P_Rand için korelasyon yok; P_Comp ve P_WordsSyn için orta korelasyon.

---

## 6. Değerlendirilen Modeller (orijinal makale)

| Tip | Modeller |
|-----|----------|
| Statik | Word2Vec, GloVe (PT için 300-boyut Hartmann 2017) |
| Bağlamsal (LSTM) | ELMo |
| Bağlamsal (Transformer, encoder) | BERT (large), mBERT, DistilBERT (mono+ML), Sentence-BERT (mSBERT) |
| Bağlamsal (autoregressive) | Llama2-13B |
| API (yalnız cümle düzeyi) | OpenAI text-embedding-ada-002 |

Her model EN ve PT'de, Nat ve Neut bağlamlarda değerlendirildi.

---

## 7. Ana Bulgular (Q1–Q3)

1. **Yüzeysel yüksek benzerlik yanıltıcıdır (Q1).** Cümle düzeyinde tüm problar (rastgele dahil)
   yüksek benzerlik üretir; bunun başlıca sebebi minimal çiftler arası **sözcüksel örtüşme**
   (lexical overlap). Benzerlikler `Comp` ile beklenen deseni göstermez.
2. **NC düzeyine inince desen biraz düzelir ama hâlâ ideal değildir.** P_Syn benzerlikleri,
   idiyomatik NC'ler için (örn. *grey matter*) düşük ve modelden modele çok değişken
   (0.27'den 0.81'e). Yani modeller idiyomatik eş anlamlılığı güvenilir yakalamıyor.
3. **İdiyomatiklik derecesi önemli (Q2).** İdiyomatik NC'lerde modeller daha çok zorlanıyor:
   `Sim_R|Syn < Sim_R|WordsSyn` — yani kelime-kelime eş anlamlı, altın eş anlamlıdan daha
   yüksek benzerlik veriyor. Bu, **sözcüksel benzerliğin hâlâ baskın** olduğunu gösterir.
4. **Bağlam yeterince kullanılmıyor (Q2).** Naturalistic (bilgilendirici) bağlam, Neutral
   bağlama göre belirgin avantaj sağlamıyor — büyük bağlamsal modellerde bile.
5. **Bağlamsallık tek başına çözüm değil (Q3).** Transformer modeller statiklerden genel olarak
   biraz yüksek benzerlik üretse de; ELMo ve mSBERT statiklere benziyor, Llama2 gibi büyük
   autoregressive modeller de statiklere yakın davranıyor. Modeller arası korelasyonlar yüksek
   → hiçbir model idiyomatiklikte açıkça üstün değil.

**Sonuç:** İdiyomatiklik mevcut kelime temsil modellerinde henüz doğru kodlanmıyor. Affinity ve
Scaled Similarity gibi **model-agnostik** ölçümler, yüksek benzerlik aldatmacasını ortadan
kaldırıp modellerin gerçek sınırlarını ortaya koyar.

---

## 8. Bu Repoda Ne Yapıyoruz?

Makalenin tüm yöntemini **model-agnostik** bir çerçeve olarak yeniden kuruyoruz; böylece aynı
problar ve metrikler **yeni/farklı modellerde** (modern LLM'ler, çok dilli embedding modelleri,
Türkçe modeller — örn. BERTurk, vb.) çalıştırılabilir. Bkz. [README.md](README.md) ve
[ROADMAP.md](ROADMAP.md).
