# NCIMP İngilizce–Portekizce Sayım Denetimi ve Türkçe Aday Seti

**Denetim tarihi:** 23 Haziran 2026  
**Yerel veri:** `data/ncimp/`  
**Türkçe çıktı:** `data/ncimp/TR/turkish_ncimp_inventory.csv`

## 1. Sayımda kullanılan birimler

NCIMP için birbirine karıştırılmaması gereken dört ayrı sayı vardır:

1. **İfade/NC türü:** Tekil iki sözcüklü isim bileşiği veya nominal MWE.
2. **Doğal örnek:** İfadeyi hedef anlamında kullanan korpus cümlesi; özgün tasarımda ifade başına üç tane (`S1–S3`).
3. **Nötr bağlam:** Anlamı belirginleştirmeyen kalıp cümle.
4. **Minimal-çift cümlesi:** Özgün cümle ile prob ikamelerinin her biri. Makaledeki 32.200 sayısı yalnız özgün örnekleri değil, prob varyantlarını da içerir.

Bu nedenle “280 İngilizce ifade”, “840 İngilizce doğal örnek” ve “19.600 İngilizce minimal-çift cümlesi” farklı veri katmanlarını anlatır.

## 2. Makalede bildirilen resmî NCIMP sayıları

Kaynak: He et al. (2025), _Investigating Idiomaticity in Word Representations_, DOI: <https://doi.org/10.1162/coli_a_00546>.

| Ölçü                                |  İngilizce | Portekizce |     Toplam |
| ----------------------------------- | ---------: | ---------: | ---------: |
| Tekil iki sözcüklü NC/MWE           |    **280** |    **180** |    **460** |
| İdiyomatik (`I`)                    |        103 |         60 |        163 |
| Kısmen bileşimsel (`PC`)            |         88 |         60 |        148 |
| Bileşimsel (`C`)                    |         89 |         60 |        149 |
| Doğal bağlam (`3 × ifade`)          |    **840** |    **540** |  **1.380** |
| Minimal-çift cümlesi (`70 × ifade`) | **19.600** | **12.600** | **32.200** |

### 2.1 İfade başına 70 cümle nasıl oluşuyor?

Makaledeki temel doğal bağlam paketi ifade başına şu 14 cümleyi üretir:

| Bileşen                                    |   Adet |
| ------------------------------------------ | -----: |
| Özgün hedef cümle                          |      1 |
| Bütüncül eş anlamlı, `NC_Syn`              |      1 |
| Bileşenlerin eş anlamlıları, `NC_WordsSyn` |      5 |
| Tek bileşen, `NC_Comp`                     |      2 |
| Frekans eşli rastgele ikame, `NC_Rand`     |      5 |
| **Bir bağlam toplamı**                     | **14** |

Üç doğal bağlam ve iki nötr kalıp birlikte beş bağlam verir: `5 × 14 = 70`. Böylece İngilizce için `280 × 70 = 19.600`, Portekizce için `180 × 70 = 12.600` ve toplamda `32.200` cümle elde edilir.

### 2.2 İnsan anotasyonu ve bağlam bilgileri

- Her ifade üç doğal cümlede aynı hedef anlamı örnekler.
- Kompozisyonellik 0 (tam idiyomatik) ile 5 (tam bileşimsel) arasında hem tür hem bağlam/token düzeyinde insan yargılarıyla ölçülmüştür.
- İngilizce: 421 anotörden 8.725 yargı; cümle başına ortalama 10,4 anotasyon.
- Portekizce: 33 anotörden 5.091 yargı; cümle başına ortalama 9,4 anotasyon.
- Ortalama doğal cümle uzunluğu: İngilizce 23,4; Portekizce 13,0 sözcük.
- Makalede sınıf başına ortalama kompozisyonellik: EN `0,95 / 2,34 / 4,13`, PT `1,52 / 2,46 / 3,61` (`I / PC / C`).

## 3. Yerel dosyalarda gözlenen gerçek sayılar

Yerel CSV’ler orijinal GitHub deposunun güncel `main` dalından `scripts/download_data.py` ile indirilmiştir: <https://github.com/risehnhew/Finding-Idiomaticity-in-Word-Representations>.

### 3.1 Dosya ve örnek sayıları

| Dil/dosya                           | Satır | Tekil kanonik ifade | Tekil özgün cümle | Toplam sütun | Cümle içeren sütun | Dolu cümle hücresi |
| ----------------------------------- | ----: | ------------------: | ----------------: | -----------: | -----------------: | -----------------: |
| EN `naturalistics_examplesent1.csv` |   281 |                 281 |               281 |          123 |                 32 |              8.992 |
| EN `naturalistics_examplesent2.csv` |   281 |                 281 |               281 |          123 |                 32 |              8.992 |
| EN `naturalistics_examplesent3.csv` |   281 |                 281 |               281 |          123 |                 32 |              8.992 |
| EN `neutral.csv`                    |   281 |                 281 |               281 |          213 |                 34 |              9.554 |
| PT `naturalistics_examplesent1.csv` |   180 |                 180 |               180 |           43 |                 12 |              2.160 |
| PT `naturalistics_examplesent2.csv` |   180 |                 180 |               180 |           43 |                 12 |              2.160 |
| PT `naturalistics_examplesent3.csv` |   180 |                 180 |               180 |           43 |                 12 |              2.160 |
| PT `neutral.csv`                    |   180 |                 180 |               180 |           61 |                 13 |              2.340 |

“Dolu cümle hücresi” sayısı CSV’deki bütün eski/alternatif prob sütunlarını kapsar; makaledeki seçilmiş 70-cümle protokolüyle doğrudan karşılaştırılmamalıdır.

### 3.2 Mevcut Python yükleyicisinin gördüğü örnekler

| Ölçü                          |          EN |      PT |
| ----------------------------- | ----------: | ------: |
| Yüklenen toplam bağlam örneği |   **1.124** | **720** |
| Doğal (`S1–S3`)               |         843 |     540 |
| Nötr                          |         281 |     180 |
| Skorlu bağlam örneği          |       1.116 |     720 |
| `P_Syn` kapsaması             | 1.124/1.124 | 720/720 |
| `P_Comp` kapsaması            | 1.124/1.124 | 720/720 |
| `P_WordsSyn` kapsaması        | 1.124/1.124 | 720/720 |
| `P_Rand` kapsaması            | 1.124/1.124 | 720/720 |

### 3.3 Makale ile yerel İngilizce dosyaları arasındaki fark

Makalede İngilizce için **280** ifade bildirilmesine karşın yerel dört CSV’nin her birinde aynı **281** kanonik ifade vardır. İnsan skoru XLSX dosyasında ise yalnız **279** İngilizce ifade bulunur.

- CSV’de bulunup XLSX’te bulunmayanlar: `dust storm`, `small fry`.
- Bu iki ifade yüzünden sekiz bağlam örneğinin skoru yoktur: dört `dust storm/dust storms`, dört `small fry`.
- `dust storm` için `S1` ve `S2` doğal cümleleri aynıdır: “kabul is now hot and dusty with frequent dust storms .”
- Sonuç olarak EN doğal bağlam sayısı 843 olsa da tekil doğal cümle sayısı 842’dir.

Bu çalışma için hedef sayı makaledeki karşılaştırılabilir resmî sayı olan **280** olarak alınmıştır. Yerel 281/279 farkı veri sürümü anomalisi olarak korunmuş, sessizce düzeltilmemiştir.

### 3.4 XLSX sınıf dağılımı

Yerel `human_compositionality scores.xlsx` dosyasındaki `ClassType` değerleri bağlam satırlarından tekil ifade düzeyine indirildiğinde:

| Dil | `I/NC` | `PC` | `C` | Skorlu tekil ifade |
| --- | -----: | ---: | --: | -----------------: |
| EN  |     91 |   89 |  99 |                279 |
| PT  |     50 |   75 |  55 |                180 |

Bu dağılımlar makalenin deney için bildirdiği EN `103/88/89` ve PT `60/60/60` ön seçim dağılımıyla aynı değildir. XLSX’in mevcut sınıfları ve makale sınıfları eşdeğer kabul edilmemeli; sonuç raporunda hangi sınıf kaynağının kullanıldığı açıkça belirtilmelidir.

## 4. Türkçe aday veri seti

Türkçe dosya, İngilizce makale hedefiyle aynı büyüklükte **280 tekil, iki sözcüklü nominal MWE** içerir.

| Ölçü                                    |    Sayı |
| --------------------------------------- | ------: |
| Tekil Türkçe ifade                      | **280** |
| Geçici `I`                              |     103 |
| Geçici `PC`                             |      88 |
| Geçici `C`                              |      89 |
| İfade başına doğal örnek                |       3 |
| Toplam doğal örnek                      | **840** |
| İnternetten alınan örnek                | **249** |
| Bu çalışmada özgün yazılan örnek        | **591** |
| En az bir internet örneği bulunan ifade | **135** |
| İfade başına nötr cümle                 |       1 |
| Toplam nötr cümle                       | **280** |

### 4.1 Kaynak ve işaretleme politikası

- Kullanılan ve ileride incelenecek bütün Türkçe kaynaklar, erişim/lisans durumu ve yerel anlık görüntü bilgileriyle [`TR/sources/README.md`](TR/sources/README.md) altında kataloglanır.
- İnternet örnekleri Tatoeba Türkçe cümle dışa aktarımından alınmıştır: <https://tatoeba.org/tr/downloads>.
- Her internet örneğinde cümle kimliğine giden URL, yazar adı, görünen lisans ve lisans-inceleme durumu ayrı sütunlarda tutulur.
- Kullanıcı talebi doğrultusunda lisans, cümleyi toplama aşamasında engelleyici filtre değildir. Lisansı belirsiz yeni kaynaklar `license_review_required` olarak işaretlenebilir.
- `I/PC` sınıflarında yüzey eşleşmesi yetmez: hedef deyimsel/lexikalleşmiş anlam elle kontrol edilmiştir. Örneğin gerçek bir arka kapıdan söz eden cümle, `arka kapı = gizli yöntem` örneği sayılmamıştır.
- `C` sınıfı düşük anlam belirsizliğine sahip olduğundan Tatoeba eşleşmeleri otomatik tam-eşleşme kontrolünden geçirilmiş ve `exact_match_low_ambiguity` etiketiyle bırakılmıştır.
- İnternette uygun cümle bulunmayan yuvalar, hedef anlamı açıkça taşıyan yeni Türkçe cümlelerle doldurulmuş ve `authored_for_dataset` olarak işaretlenmiştir.
- Anlam açıklamaları TDK Sözlükleriyle kontrol edilip yeniden yazılmıştır; TDK metni kelimesi kelimesine kopyalanmamıştır: <https://sozluk.gov.tr/>.
- Ek aday/doğrulama kaynağı olarak 2026 Türkçe deyim derlemi incelenmiştir: <https://github.com/coltekin/turkish-idioms> ve <https://aclanthology.org/2026.mwe-1.12/>. Güncel TSV 10.969 kayıt içerir; 201 kayıtta tamamlanmış örnek alanı vardır. Kaynağın büyük bölümü fiil deyimi olduğu için NCIMP ana setine doğrudan aktarılmamıştır.

### 4.2 CSV’deki temel alan grupları

- **Kimlik/yapı:** `mwe_id`, `language`, `canonical_form`, `token_count`, `mwe_type`, `modifier`, `head`.
- **Geçici anotasyon:** `comp_class_provisional`, boş bırakılan `comp_score_gold_0_5`, `annotation_status`.
- **Anlam:** `meaning_tr`, anlam kaynağı URL’si, yeniden kullanım ve lisans inceleme işaretleri.
- **Bağlam:** `neutral_sentence` ile üç doğal örnek.
- **Her örnek için provenans:** hedef yüzey biçimi, `origin`, kaynak adı/URL’si/yazarı/lisansı, lisans ve anlam inceleme durumu.

## 5. Bilimsel kullanım sınırı ve sonraki zorunlu aşama

Türkçe CSV şu anda **kürasyon ve cümle toplama katmanıdır**; henüz tam NCIMP minimal-çift paketi veya insan anotasyonlu altın standart değildir.

Mevcut deney kodunda Türkçeyi EN/PT ile aynı şekilde çalıştırmadan önce her ifade için şunlar tamamlanmalıdır:

1. En az üç bağımsız ana dili Türkçe anotörden 0–5 tür ve token kompozisyonellik puanı.
2. Uzman uzlaşmasıyla nihai `I/PC/C` sınıfı; mevcut sınıflar yalnız seçim/kürasyon etiketidir.
3. Bütüncül eş anlamlı/parafraz (`P_Syn`).
4. Tek bileşen varyantları (`P_Comp`).
5. İki bileşenin ayrı eş anlamlıları (`P_WordsSyn`).
6. Türkçe sıklıklarla eşlenmiş beş rastgele gerçek MWE (`P_Rand`).
7. Her özgün ve ikame cümlede hedef token spanlarının doğrulanması.

Bu aşamalar tamamlanmadan üretilecek Spearman korelasyonu veya EN/PT karşılaştırması “altın insan skorlu Türkçe NCIMP sonucu” olarak raporlanmamalıdır.

## 6. Makale Experiment 4 için Türkçe ordinary-control

Güncel makale taslağındaki ordinary-perturbation kalibrasyonunu Türkçe'ye taşımak
için [`TR/turkish_ordinary_control.csv`](TR/turkish_ordinary_control.csv) üretildi.

| Grup | Kayıt |
| --- | ---: |
| Deyimsel NC (`idiomatic_nc`) | 16 |
| Bileşimsel NC (`compositional_nc`) | 16 |
| Sıradan tek kelime (`single_word_control`) | 16 |
| Sıradan iki sözcüklü ifade (`ordinary_two_word_control`) | 16 |
| **Toplam** | **64** |

Her satır özgün cümle, hedef yüzey, eşanlamlı, bileşen, sözcük-sözcük karşılık,
ilişkili kontrol ve rastgele kontrol içerir. Cümleler bu çalışma için yazılmıştır.
Bu paket henüz gold değildir: bütün satırlar `review_required`, rastgele ikameler
`pending_corpus_validation`, lisans alanları ise proje-yazarlı yayın onayı bekliyor
olarak işaretlenmiştir. Uygulamadaki Prob stüdyosu 64 kararın tamamını ayrı
Firestore review kaydı olarak toplar; validator `ordinary_control_review` kapısını
ancak 64 kayıt onaylandığında kapatır.

Kalibrasyon:

`ordinary_gap = (single_word_gap + ordinary_two_word_gap) / 2`

`OCG_g = group_synonym_minus_random_gap / ordinary_gap`

Birincil analiz düzeyi makaleyle aynı biçimde `contextual_span`dır; tam cümle
benzerliği ortak cümle çerçevesi tarafından yükseltilebildiği için birincil kanıt
olarak kullanılmaz.
