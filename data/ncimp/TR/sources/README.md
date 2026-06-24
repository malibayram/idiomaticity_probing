# Türkçe MWE ve Korpus Kaynak Kataloğu

Bu klasör, Türkçe NCIMP uzantısında kullanılabilecek sözlük, deyim veri seti, anotasyonlu MWE derlemi, genel korpus ve semantik kaynakları tek yerde izler.

- Makinece okunabilir envanter: [`source_manifest.csv`](source_manifest.csv)
- İndirilen ham anlık görüntüler: `raw/` (boyut ve kaynak hakları nedeniyle Git tarafından izlenmez)
- Ana Türkçe aday seti: [`../turkish_ncimp_inventory.csv`](../turkish_ncimp_inventory.csv)
- EN/PT sayım ve yöntem denetimi: [`../../DATASET_AUDIT_EN_PT_TR.md`](../../DATASET_AUDIT_EN_PT_TR.md)

## Durum özeti

| Kimlik            | Kaynak                       | Durum                                                   | NCIMP açısından en yararlı tarafı                    |
| ----------------- | ---------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| `SRC-001`         | 2026 Turkish Idiom Benchmark | Kullanıldı, yerel TSV kaydedildi                        | Aday deyim, anlam, idiomatik/literal bağlam          |
| `SRC-002`         | Tatoeba Türkçe               | Kullanıldı, yerel sıkıştırılmış dışa aktarım kaydedildi | Doğal cümle ve yüzey biçimi                          |
| `SRC-003`         | TDK Sözlükleri               | Çevrim içi kullanıldı                                   | Kanonik biçim ve anlam kontrolü                      |
| `SRC-004/005`     | PARSEME 1.3 / 2.0            | Yüksek öncelikli aday                                   | İnsan işaretli MWE spanı ve biçimbilimsel çeşitlilik |
| `SRC-006`         | Dodiom                       | Erişim yolu bulunmalı                                   | 35 deyimde 6.861 idiomatik/literal cümle             |
| `SRC-009`         | KeNet                        | Kullanıldı, XML ve lisans anlık görüntüsü kaydedildi    | `P_Syn` ve `P_WordsSyn` inceleme adayları            |
| `SRC-010`         | TSRC                         | Erişim doğrulanamadı                                    | Büyük ölçekli eş anlamlı/eş tür çiftleri             |
| `SRC-011/012/013` | TNC, TS Corpus, Leipzig      | Korpus adayları                                         | Doğal örnek, sıklık ve `P_Rand` eşleme               |
| `SRC-014`         | Vikisözlük/Vikipedi          | Açık kaynak adayı                                       | Tanım ve atıflı örnek cümle                          |

Tam bağlantılar, sayılar, lisans/erişim notları ve son kontrol tarihi manifesttedir.

## Yerel anlık görüntüler

23 Haziran 2026 tarihinde saklanan dosyalar:

| Dosya                                                   |  Boyut | SHA-256                                                            |
| ------------------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `raw/coltekin_turkish_idioms_2026-06-23.tsv`            | 1,4 MB | `149a5b6edb73ebad3b92420130eda74d9b97872859cdeaaed0f9cdb7c05ff804` |
| `raw/coltekin_LICENSE_CC-BY-4.0.txt`                    |  20 KB | `f5b745ef98087f531e719ee8ca6a96809444573ecc7173c6fa68eaad39b3cc3f` |
| `raw/coltekin_README.md`                                |   4 KB | `4453b0a3db62e7f7d91266a2a380804cf32a68a31077f08fac915689c07ae4be` |
| `raw/tatoeba_tur_sentences_detailed_2026-06-20.tsv.bz2` |  13 MB | `78ff98521bc6853c7ea3ae1fc91d05107a3f217015e9186c711e732038bec063` |
| `raw/kenet_2026-06-23.xml`                              |  52 MB | `4023b4f815dcae78171c69d26e6f31aae3ba70c98fb2e44919a09e87d673d66c` |
| `raw/kenet_LICENSE_GPL-3.0.txt`                         |  35 KB | `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986` |
| `raw/kenet_README.md`                                   |  17 KB | `57c86fc35ea1529e4f503852175b5e6ba5b3bc37f57bd9ebfaa3b6ac82f79b9b` |

Turkish Idiom Benchmark anlık görüntüsü 10.969 kayıt içerir. Alan dolulukları: `sample=201`, `entailment=201`, `non-entailment=201`, `literal=198`. Tatoeba anlık görüntüsünde 747.947 Türkçe cümle satırı vardır.

KeNet, `scripts/build_kenet_probe_candidates.py` ile yalnız tam normalize lemma
eşleşmesi ve açıkça işaretli Türkçe iyelik/ünsüz yumuşaması geri dönüşleri üzerinden
işlenir. Çıktılar `studio/public/candidates/kenet_probe_candidates.{json,csv}`
altındadır. 280 hedefin 151'i tam MWE lemması olarak bulundu; 46 hedefte en az bir
`P_Syn`, 220 hedefte iki bileşeni de değiştiren en az bir `P_WordsSyn` adayı oluştu.
Bunlar altın prob değildir: bütün adaylar anlam, biçimbilim, cümle dilbilgisi ve
içerik lisansı için `review_required` olarak tutulur.

## Önerilen inceleme sırası

1. **KeNet:** Üretilen bütüncül ve bileşen eş anlamlılarını hedef anlam ve dilbilgisi açısından insan incelemesinden geçir.
2. **PARSEME 2.0 ve 1.3:** Türkçe bölümün gerçek kapsamını indirip nominal MWE, fiil MWE ve mevcut 280 hedefle örtüşme sayılarını çıkar.
3. **TS Corpus + TNC:** Her hedef için ek doğal örnekleri, tür/alan çeşitliliğini ve sıklık değerlerini topla.
4. **Dodiom:** 35 ifadenin hangilerinin mevcut setle örtüştüğünü ve literal/idiomatik ayrımın nasıl anotlandığını incele.
5. **TSRC:** Erişim sorunu çözülürse eş anlamlı ve co-hyponym çiftlerini `P_Syn`, `P_WordsSyn` ve `P_Rand` aday üretiminde kullan.

## Bir kaynağı veri setine alma kuralı

Her yeni cümle veya sözlük girdisi en az şu bilgileri taşımalı:

- `source_id`
- kaynak kayıt/cümle kimliği
- doğrudan URL ve erişim tarihi
- özgün yazar veya veri üreticisi
- görünen lisans/koşul ve `license_review_status`
- hedef yüzey biçimi
- hedef anlamın gerçekten kullanılıp kullanılmadığına ilişkin `sense_review_status`
- başka bir kaynaktan kopya/örtüşme olup olmadığı

PARSEME 1.3, Berk et al. korpusu ve Dodiom gibi soy ilişkisi veya yeniden kullanım ihtimali bulunan kaynaklar bağımsız veriymiş gibi toplanmamalı; cümle düzeyinde tekilleştirilmelidir.
