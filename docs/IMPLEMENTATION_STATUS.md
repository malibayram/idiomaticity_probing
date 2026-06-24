# NCIMP Research Studio - Uygulama Durumu

Bu dosya, kullanıcı ve Codex'in paralel çalışmasında çakışmaları önlemek için güncel tutulur.

## Çalışma kuralları

- Kullanıcının mevcut değişiklikleri geri alınmaz veya yeniden yazılmaz.
- Düzenleme öncesinde hedef dosya ve `git status` yeniden kontrol edilir.
- Aynı alanda çakışma varsa kullanıcı değişikliği korunur; belirsiz niyet varsayılmaz.
- Yayınlanmış veri setleri yerinde değiştirilmez; yeni sürüm oluşturulur.

## 23 Haziran 2026 - Başlangıç durumu

### Korunan kullanıcı değişiklikleri

- `article_perturbation_calibration/main.pdf`: değiştirilmedi.
- Türkçe envanter, kaynak kataloğu ve veri denetimi: uygulamanın seed/import kaynağı olarak korunuyor.
- Kullanıcının oluşturduğu `studio/` React 19/Vite 8/Tailwind 4 iskeleti kanonik uygulama olarak benimsendi.
- Kullanıcının `AuthProvider`, rol modeli, UI bileşenleri ve rota iskeleti korunarak uygulamaya bağlandı.

### Tamamlanan

- React/TypeScript/Vite proje kabuğu
- Firebase Auth, Firestore ve Hosting yapılandırma dosyaları
- Rol ve araştırma veri tipleri
- Uygulama navigasyonu ve kimlik/onay ekranları
- Gerçek `cross-lingual-mwe` Firebase web yapılandırması (`studio/.env.local`, Git dışında)
- Kullanıcı kararıyla Firebase Storage kaldırıldı; veri ve rapor dosyaları Hosting'de statik sunulacak.
- Firestore güvenlik kuralları (`studio/firestore.rules`): her işlemde rol denetimi;
  `/users/{uid}` yalnız `pending` olarak self-create, rol değişimi yalnız admin;
  anotasyon ve audit kayıtları immutable (update/delete kapalı); anotör başkalarının
  cevaplarını ve atamalarını göremez; `released` dataset sürümü değiştirilemez; default-deny.
- `studio/firebase.json` (emulator + hosting rewrites), `firestore.indexes.json`.
- **Canlı deploy:** `firestore:rules` + `firestore:indexes` ve Hosting
  `cross-lingual-mwe` projesine yüklendi (`studio/` kökünden). Storage yoktur;
  statik seed/rapor/artifact dosyaları Hosting'den sunulur.
- Doğrulama: `tsc -b` ve `npm run build` temiz.
- Türkçe seed: 280 MWE, 1.400 bağlam, span denetimi ve 16 kaynak kaydı.
- Paper-exact release doğrulayıcısı, Markdown/JSON gate raporu ve draft export.
- Güvenli yerel worker: validate/export/experiment/analysis whitelist'i, yol sınırı,
  model allowlist'i, Firestore claim/heartbeat/cancel adaptörü ve yerel smoke koşusu.
- Anotasyon çekirdeği: dengeli pilot seçimi, sekiz anotörlü kör atama,
  snapshot hash, agregasyon, bootstrap CI, ordinal alpha ve ICC.
- KeNet kaynak anlık görüntüsü ve insan incelemeli prob adayı çıkarımı: 151/280
  tam MWE eşleşmesi; 46 hedefte `P_Syn`, 220 hedefte `P_WordsSyn` adayı.
  3.781 adayın hiçbiri otomatik onaylanmaz; synset/tanım/örnek/lisans kanıtı saklanır.
- Test paketi: 19 Python testi temiz; Vite üretim build'i temiz.

### Bilinen sorunlar / notlar

- İlk admin bootstrap çözüldü (Admin SDK'sız): `isBootstrapAdmin()` + `AuthProvider`
  ile `VITE_BOOTSTRAP_ADMIN_EMAIL` (malibayram20@gmail.com) ilk girişte `admin`.
- Firebase Emulator + Vitest ile rol/güvenlik matrisi testleri henüz yazılmadı.
- Üretim bundle'ı ~1.009 kB (firebase + echarts); route lazy import ile code-split edilmeli.
- Firestore'da üretim seed'i henüz yüklenmedi; uygulama bundled seed fallback'ini kullanıyor.
- KeNet yalnız 46 hedef için bütüncül eş anlamlı üretti; eksik `P_Syn` adayları
  sözlük/korpus ve insan parafrazıyla tamamlanmalı.

### Aşama 2 - UI ekranları (Claude, sürüyor)

- **MWE envanteri** (`studio/src/routes/MweInventory.tsx`): `useResearchSnapshot()`
  ile 280 ifade; arama + sınıf + iş akışı filtreleri; sıralanabilir TanStack tablo;
  seçilen ifade için bağlam/span detay paneli (`SpanText` ile hedef vurgusu).
  `/mwes` route'una bağlandı; nav "yakında" rozeti kaldırıldı.
- **Dashboard** gerçek seed verisine bağlandı: toplam MWE, sınıf dağılımı,
  iş akışı durumu, gold puanlı/kaynak/kampanya sayıları, Firestore/yerel-seed kaynağı.
- Yeni UI primitive'leri: `badge`, `input`, `select`, `SpanText`; `lib/domain-labels.ts`.
- **Kaynak kütüphanesi** (`SourcesLibrary.tsx`): 16 kaynak; kategori/öncelik/arama
  filtreleri; lisans incelemesi uyarı olarak (engel değil); kaynak/makale linkleri.
- **Sonuçlar** (`ResultsView.tsx`): MAKALE çerçevesine göre yeniden kuruldu
  (`build_results_dataset.py` → `run_indicators.json` schemaVersion 2; Codex'in
  `lib/results-data.ts` v2 şeması tüketiliyor). 20 model · 4 deney bloğu
  (encoder replikasyon / embedding / decoder LLM / **OCG ordinary-perturbation**).
  Bölümler: **Ana bulgu** (ICS yakalama eşiği 0,55/0,70, en yüksek ICS), gösterge
  lejantı, deney/aile/dil filtreleri, eşik çizgili **gösterge sıralaması** (FLOOR
  anizotropi 0,90 işaretli), model×7-gösterge ısı haritası, **Deney 4 OCG paneli**
  (OCG idiyom vs kompozisyonel, taban 1,0, kararsız/çökük-uzay uyarısı + tablo),
  aileye göre scatter, filtreli/sıralı tam tablo, yöntem notları. `tslib` eklendi.
  Veri makaleyle uyumlu (OCG_idiom max 0,68 = Gemma4-12B-base). TR/sentence koşular
  eklenince UI otomatik gösterir.
- **Yönetim** (`AdminPage.tsx`): canlı `/users` listesi (`lib/admin-users.ts`),
  pending onayı + rol atama (kendi rolü kilitli), ve Codex'in `seedResearchProject`
  butonu (idempotent Firestore seed + query invalidation).
- **Prob stüdyosu** (`ProbeStudio.tsx`): MWE bazında P_Syn/P_Comp/P_WordsSyn/P_Rand
  adayları, hedef çokluk (1/2/5/5) ve review durumu rozetleri (salt-okunur).
- **Doğrulama & yayın** (`ReleaseGate.tsx`): snapshot'tan canlı yayın kapısı
  kontrol listesi (7 kapı + 19.600 cümle hedefi), pass/fail sayaçları.
- **Deneyler** (`ExperimentsView.tsx`): iş kuyruğu + koşu özeti (salt-okunur).
- **Performans:** in-shell ekranlar `React.lazy` + AppShell Suspense ile code-split;
  echarts ayrı chunk. Ana bundle ~865 kB (önce ~2,16 MB).
- Doğrulama: `tsc -b` + `npm run build` temiz; dev sunucu boot temiz, konsol hatasız,
  seed (`/seed/tr_project.json`) serve ediliyor (preview ile doğrulandı).
- **Örnek laboratuvarı** (`ExamplesLab.tsx`): MWE bazında 5 bağlam, span vurgusu,
  provenance/lisans/review durumu; "korpus örneği eksik" iş kuyruğu filtresi.
- **Anotasyon** (`AnnotationView.tsx`): kampanya genel görünümü (ilerleme, α uyum
  eşiği <0,67 uyarısı) + canlı "Görevlerim" sorgusu (`lib/annotation-tasks.ts`,
  `assigneeId==uid`). Görev doldurma formu canlı atama akışı bağlanınca eklenecek.
- **Tüm 10 modül ekranı artık gerçek** - placeholder kalmadı. Lint/tsc/build temiz.

### Aktif çalışma

- KeNet adaylarının prob stüdyosuna bağlanması ve Firestore review kararları
- Firestore emulator/rules testleri ve frontend birim/E2E test altyapısı
- Eksik internet örnekleri, `P_Syn`, `P_WordsSyn`, frekans eşli `P_Rand`
- Claude ekranları: admin seed/rol, prob, anotasyon, release, deney ve sonuç

### Sıradaki

- Üretim Firestore seed'i ve gerçek kullanıcı/rol akışı
- Anotasyon kampanyası ve görev ekranı
- Prob/variant insan incelemesi
- Yerel Firebase worker'ın servis hesabı/ADC ile canlı iş kuyruğuna bağlanması
- 19.600 cümlelik yayın kapılarını kapatacak gold anotasyon ve prob seti

## 24 Haziran 2026 - Makale uyumlu uçtan uca çalışma durumu

### Çalışan arayüz akışları

- EN/PT referans envanteri artık görünür: dil sekmeleri, 5 bağlam, insan puanı ve
  sınıfı, `P_Syn/P_Comp/P_WordsSyn/P_Rand` cümleleri, span vurgusu ve CSV indirme.
  EN raw 281 / skorlu 279 / makale 280 anomalisi özellikle görünür tutulur.
- Anotasyon formu aktif: create-once Firestore seed, tek-küratör ön etiketleme
  (gold dışı), 8 anotörlü pilot, 0–5 puanlar, güven, zorunlu parafraz, immutable
  submit, küratör accept/exclude, agregasyon kuyruğu ve gold adjudication.
- Örnek laboratuvarı Tatoeba adaylarını S1/S2/S3'e onaylar/reddeder; onaylanan
  örnek bağlamı ve bağlı prob varyantlarını revision kontrolüyle günceller.
- Prob stüdyosu KeNet ve frekans eşli P_Rand adaylarını kanıt/not ile onaylar;
  ayrıca Experiment 4'ün 64 Türkçe ordinary-control kaydını inceleme kuyruğuna açar.
- Deney ekranı validate/aggregate/export/smoke/analysis işlerini kuyruğa alır ve
  queued/running işleri iptal eder.
- Yayın ekranı yalnız Python backend validator raporunu tüketir; optimistic istemci
  hesabı kaldırılmıştır. Tam hata listesi ve statik artefakt indirmeleri görünür.
- Yönetici rol değişimleri audit event üretir; seed ikinci kez canlı kürasyonun
  üzerine yazamaz.

### Makale protokolü ve artefaktlar

- Protokol: `ncimp-ordinary-calibrated-v2`; kaynak taslak
  `article_perturbation_calibration/main.tex`.
- Sonuç paketi: 20 çalışma modeli, 26 EN/PT diagnostik satırı, 7 temel metrik,
  ICS/FLOOR eşikleri ve 20 Experiment-4 OCG satırı.
- Türkçe ordinary-control: dengeli 64 kayıt (16 I, 16 C, 16 sıradan kelime,
  16 sıradan iki sözcüklü ifade); bütün kayıtlar insan/frekans incelemesi bekler.
- Validator'a `ordinary_control_review` kapısı eklendi. Güncel seed raporu:
  280 MWE, 1.400 bağlam, 4.200 mevcut cümle, 8.880 açık hata.

### Doğrulama

- Python: 24 test geçti.
- Frontend veri/şema: 13 test geçti.
- Firestore Rules Emulator: ordinary-control kapsamı dahil 18 test geçti.
- `npm run lint`: temiz.
- `npm run build`: temiz.

### Dış önkoşullar / kalan gerçek veri işi

- Canlı Firestore rules/indexes ve Hosting son doğrulanmış build ile günceldir.
- Worker'ın canlı kuyruğu tüketmesi için güvenli servis hesabı veya ADC gerekir.
- 8 bağımsız anotörün kayıt olması, pilotların tamamlanması, 64 control incelemesi,
  eksik P_Syn/P_WordsSyn/P_Rand ve 19.600 cümle kapısının kapanması insan emeği
  gerektirir; sistem bu işleri artık arayüzden takip eder ve yürütür.

## 24 Haziran 2026 - 09:14 canlı yayın doğrulaması

- Python: 24/24 test geçti.
- Frontend veri/şema: 13/13 test geçti.
- Firestore Rules Emulator: 18/18 test geçti.
- `npm run lint` ve `npm run build`: temiz.
- Firestore rules, indexes ve Hosting `cross-lingual-mwe` projesine dağıtıldı.
- Firebase Hosting sürümü: `510d71555fd0a355`; yayın zamanı
  `2026-06-24T06:14:04.029Z`.
- Canlı `/` ve `/annotation` rotaları HTTP 200; TR seed, EN/PT referans paketleri,
  64 ordinary-control kaydı, validator raporu ve sonuç paketi Hosting'den
  okunabiliyor.
- Canlı seed: `ncimp-ordinary-calibrated-v2`, 280 MWE, 16 kaynak, 2 kampanya,
  26 referans koşusu. Firestore'a create-once üretim seed'i henüz kullanıcı
  tarafından yüklenmedi; arayüz bundled seed fallback'i ile çalışıyor.
- Güncel veri kapıları: 280 gold eksik, 840 token ve 280 type anotasyon görevi,
  64 ordinary-control incelemesi, 550 bağlam incelemesi, 145 dış örnek kapısı,
  1.120 prob ve 5.600 varyant incelemesi. Mevcut 4.200 / hedef 19.600 cümle;
  validator toplam 8.880 açık hata bildiriyor.
- Sistem yazılımı canlı ve işlevsel; veri setinin gold/yayın hazır duruma gelmesi
  bağımsız anotörlerin ve küratörlerin yukarıdaki kuyrukları tamamlamasına bağlıdır.

## 24 Haziran 2026 - 10:00 herkese açık araştırma atlası

- `/` artık login gerektirmeyen, eski yayımlanmış makale ile yeni 2026 taslağını
  birlikte açıklayan ayrıntılı araştırma tanıtım sayfasıdır.
- `/dataset` EN (281 ham), PT (180), TR (280) ve 64 ordinary-control kaydının
  tamamını; bütün bağlam ve prob varyantlarıyla salt-okunur, aranabilir ve
  sayfalanmış olarak gösterir.
- Research Studio `/studio` altına taşındı; eski modül URL'leri geriye uyumlu
  yönlendirilir. İşaretleyici girişi kamu sayfasındaki tek CTA'dan erişilir.
- Tanıtım içeriği `paper.pdf`, `article_perturbation_calibration/main.tex`, gerçek
  `run_indicators.json` ve yayımlanan veri artefaktlarından oluşturuldu.
- Kamu sayfasında grey matter/economic aid karşılaştırması, dört prob ailesi,
  Similarity/Affinity/Scaled Similarity ile ISC/IG/LOD/AID/FLOOR/RHO/ICS/OCG,
  dört deney, ICS ve OCG grafikleri, yöntem uyarıları ve Türkçe genişletme durumu
  açıkça gösterilir.
- Public ziyaretçi otomatik Firebase Anonymous Auth oturumu alır. Firestore'da
  `publications/ncimp-public-v1` yalnız oturumlu okumaya açık; admin/küratör draft
  oluşturabilir, `released` durumundan sonra root ve alt kayıtlar immutable'dır.
- Yönetim ekranına TR/EN/PT/control kayıtlarını immutable kamu snapshot'ına yazan
  `Kamu yayınını oluştur` işlemi eklendi. Yayın yoksa gözden geçirilmiş bundled
  artefakt geçici fallback'tir.
- App Check istemci entegrasyonu hazır; `VITE_FIREBASE_APPCHECK_SITE_KEY` verilince
  reCAPTCHA Enterprise provider otomatik başlar. Site-kökeni iddiasının geçerli
  olması için Firebase Console'da uygulama kaydı ve Firestore enforcement gerekir.
- Doğrulama: frontend 13/13, Firestore Rules 20/20, lint temiz, production build
  temiz; masaüstü 1440 px ve mobil 500 px render görsel olarak incelendi.
- Canlı Hosting sürümü `0febc0b9375e0781`; yayın zamanı
  `2026-06-24T07:00:07.588Z`.
