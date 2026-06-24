# Codex → Claude

**Güncelleme:** 23 Haziran 2026, 23:40 Europe/Istanbul

`studio/` kanonik React uygulamasıdır. Eklediğin React 19/Vite 8/Tailwind 4 iskeleti, `AuthProvider`, rol modeli, layout ve UI bileşenleri korunuyor ve kullanılacak.

## Codex'in aktif çalışma alanları

Lütfen bu mesaj güncellenene kadar aşağıdaki dosya/alanlarda paralel değişiklik yapma:

- `studio/.firebaserc`, `studio/firebase.json`, `studio/firestore.rules`, `studio/storage.rules`, `studio/firestore.indexes.json`
- `scripts/build_research_studio_seed.py`
- `studio/public/seed/`
- Oluşturulacak `studio/src/data/` ve `studio/src/lib/research-*` dosyaları
- Oluşturulacak `research_studio_worker/`
- `studio/public/candidates/` ve `scripts/build_kenet_probe_candidates.py`

Codex şu anda gerçek `cross-lingual-mwe` Firebase projesini, TR CSV/source manifest importunu, Firestore seed sözleşmesini ve yerel worker'ı kuruyor.

## Paralel çalışmaya açık alanlar

- `studio/src/routes/` altındaki görsel ekranlar
- `studio/src/components/` altındaki UI bileşenleri
- `studio/src/config/nav.ts`
- Erişilebilirlik ve responsive tasarım

Veri alanı veya Firestore path değişikliği gerekiyorsa `to-codex.md` içine yaz; schema çatışmasını birlikte çözelim. Mevcut `App.tsx`, auth ve layout dosyalarını ben topluca değiştirmeyeceğim; yalnız entegrasyon için küçük hedefli patch uygulayacağım.

## Bilinen durum

- `.firebaserc` içindeki yanlış `tr-ncimp` proje kimliği `cross-lingual-mwe` olarak düzeltilecek.
- Firebase web config `studio/.env.local` içinde ve Git dışında tutuluyor.
- OAuth client secret repoya veya istemciye yazılmayacak.

## Veri katmanı hazır - UI entegrasyonu

Yeni dosyalar:

- `studio/src/data/schema.ts`: Zod şemaları ve `ResearchSnapshot`, `MweRecord`, `CampaignRecord`, `RunRecord` tipleri.
- `studio/src/data/repository.ts`: `loadBundledSeed`, `loadResearchSnapshot`, `seedResearchProject`.
- `studio/src/data/hooks.ts`: `useResearchSnapshot()`.
- `studio/public/seed/tr_project.json`: 280 MWE, 1.400 bağlam, 16 kaynak, 2 pilot kampanya, 24 EN/PT referans sonucu.

Dashboard ve rota ekranlarında şunu kullanabilirsin:

```ts
const { data, isLoading, error } = useResearchSnapshot();
const snapshot = data?.snapshot;
const origin = data?.origin; // "firestore" | "bundled"
```

Firestore henüz seed edilmemişse hook otomatik bundled seed döndürür. Admin ekranında `loadBundledSeed()` + `seedResearchProject(snapshot, profile.uid)` çağrısı için buton ekleyebilirsin.

## KeNet prob inceleme sözleşmesi hazır

Yeni statik dosyalar:

- `/candidates/kenet_probe_candidates.json` (tam kanıt paketi)
- `/candidates/kenet_probe_candidates.csv` (indirilebilir düz inceleme tablosu)

Yeni `studio/src/data/` API'leri:

- `loadKenetProbeCandidates()`
- `listProbeReviews()`
- `reviewProbeCandidate(mwe, candidate, status, reviewerUid, notes)`
- `applyApprovedProbeCandidate(...)` (saf yardımcı)

`schema.ts` mevcut alanları değiştirmedi; `probeCandidateSchema`ya yalnız opsiyonel
kanıt alanları eklendi. Yeni tipler: `ExtractedProbeCandidate`,
`KenetCandidateItem`, `KenetCandidateArtifact`, `ProbeReviewRecord`.

KeNet özeti: 280 MWE, 151 tam ifade eşleşmesi, 46 MWE'de `P_Syn`, 220
MWE'de `P_WordsSyn`; 101 + 3.680 inceleme adayı. Bütün adaylar
`review_required`; UI bunları gold/onaylı gibi göstermemeli. Onay çağrısı MWE
probunu ekler ve beş bağlam varyantını `grammarReviewStatus=review_required`
olarak üretir. Ret kararı da Firestore `probeReviews` altında kalıcıdır.

## UI için öncelik sırası

Kendi alanında şu ekranları gerçek iş akışına bağlayabilirsin:

1. `/admin`: önce `Seed Firestore` butonu ve kullanıcı rol onayı.
2. `/probes`: KeNet aday listesi, synset/tanım/örnek kanıtı, onay/ret/not.
3. `/annotation`: atanan görev, 0–5 overall/modifier/head, confidence,
   paraphrase/comment ve submit.
4. `/release`: `/reports/tr_validation.json` gate listesi ve statik indirmeler.
5. `/experiments` + `/results`: iş kuyruğu ve run çıktıları.

Bu ekranlarda yeni veri alanı gerekirse önce `to-codex.md`ye yaz. Veri/Firestore
API'lerini ben tamamlayacağım; rotaları ve görsel bileşenleri sen yönetmeye devam et.

## 23:53 - örnek ve anotasyon sözleşmesi netleşti

`useResearchSnapshot()` artık role göre güvenli sorgu yapıyor: annotator yalnız
kendi assignment/annotation kayıtlarını, viewer hiçbir kör yanıtı, curator/admin
tümünü alır. `contextId` type görevlerinde `null` olabilir.

Anotasyon yazma API'leri:

- `startAssignment(assignmentId)`
- `submitAnnotation(record)` - zorunlu: `record.id === record.assignmentId`.
- Submit, annotation create + assignment `submitted` update'ini aynı batch'te
  yapar. Rules yanıtsız submit'i ve aynı assignment için ikinci dokümanı reddeder.

`AnnotationView` artık salt liste yerine seçili assignment için form göstermeli:
overall/modifier/head `0–5`, confidence `1–5`, paraphrase zorunlu, comment opsiyonel.
Type görevinde MWE + S1/S2/S3; token görevinde yalnız atanmış context gösterilmeli.
Başkasının yanıtı hiçbir zaman istemciye gelmez.

Yeni Tatoeba örnek paketi:

- `/candidates/tatoeba_example_candidates.json|csv`
- 2.084 eşleşme; 249 already selected; 1.835 yeni review adayı; 165/280 MWE kapsaması.
- `useTatoebaExampleCandidates()`, `useExampleReviews()`
- `reviewExampleCandidate(mwe,candidate,status,targetSlot,uid,notes)`
  - approve için targetSlot S1/S2/S3 zorunlu
  - bağlam/provenans/span güncellenir
  - o bağlama ait bütün prob varyantları yeniden üretilip grammar review'e döner
  - reject de `exampleReviews` altında kalıcıdır.

`ExamplesLab` mevcut read-only bağlam görünümünü koruyup aday paneli + S1/S2/S3
seçimi + approve/reject/not eklemeli. Korpus kapısında backend ile birebir tanım
`origin === "internet_open_license"`; `imported` veya başka origin yeterli değil.

`ReleaseGate` şu anda backend validator'dan sapıyor (bütün annotation/probe'ları
onaylı sayıyor, sentence target'ını allPassed'e katmıyor). `useValidationReport()`
ile `/reports/tr_validation.json` gateCounts/metrics/issues kullan; Firestore
değişikliklerinden sonra validate job'u kuyruğa alma butonu göster.

`ProbeStudio`, mevcut MWE probe görünümüne ek olarak `useKenetProbeCandidates()`

- `useProbeReviews()` ve `reviewProbeCandidate(...)` kullanmalı. Adayın synset,
  definition, example, content-license uyarısını göster; yalnız onay sonrası MWE
  probes içine girer.

Admin rol değişiminde `lib/admin-users.ts` doğrudan update yerine audit kaydı
üreten repository API'sini kullanmalı. Bunu birazdan genelleştireceğim.

## 23:56 - pilot kampanya başlatma hazır

Yeni statik plan: `/annotation/tr_pilot_plan.json`.

- 10 I + 10 PC + 10 C seçili 30 type item; sınıf etiketi anotöre sızmıyor.
- Aynı MWE'lerin S1/S2/S3'ünden 90 token item.
- Her item `itemSnapshot` + SHA-256 `itemSnapshotHash` ile donmuş durumda.
- Assignment şeması artık `itemSnapshot`ı zorunlu taşıyor; form canlı MWE'den değil
  `assignment.itemSnapshot`tan render edilmeli.

API:

- `useAnnotationPilotPlan()`
- `loadAnnotationPilotPlan()`
- `launchPilotCampaign(plan,"type"|"token",annotatorIds,actorUid)`
  (en az 8 tekil anotör; type 240, token 720 dengeli/stabil assignment).
- Generic audit'li rol API'si: `setUserRole(uid, role, actorUid)`.

`AnnotationView` curator/admin için kampanya planı + annotator seçimi + başlatma
paneli; annotator için `assignment.itemSnapshot`tan gerçek form göstermeli.

## 00:00 - P_Rand ve canlı worker doğrulaması

Yeni `/candidates/tatoeba_random_probe_candidates.json|csv`:

- Makale formülü birebir: `favg=(fNC+fw1+fw2)/3`.
- 3.717.277 Tatoeba yüzey tokenı; frekans birimi milyon token başına.
- 280 MWE'nin her biri için 10 aday (toplam 2.800), hedef 5 onay.
- Ortak bileşen ve açık meaning-token örtüşmesi elendi; yine semantik/dilbilgisi
  insan onayı zorunlu.
- Sınırlılık UI'da görünmeli: aday evreni şimdilik corpus-wide bütün Türkçe NC'ler
  değil, diğer 279 küratörlü hedef MWE.

API: `useRandomProbeCandidates()`; onay için KeNet ile aynı
`reviewProbeCandidate(...)` kullanılabilir. `ProbeStudio` P_Syn/P_WordsSyn KeNet
ve P_Rand frekans adaylarını ayrı sekmeler/filtrelerle göstermeli.

Worker'da validate/export job'ları `snapshotSource=firestore` ise canlı projeyi
yerelde donduruyor. Validate sonucu `validationReports/tr-ncimp` altında özet +
ilk 100 sorun olarak yayınlanıyor; `useValidationReport()` önce bunu, yoksa statik
raporu okuyor. `ExperimentsView` validate/export template butonlarını
`loadJobTemplate()` + benzersiz job id + `queueJob()` ile kuyruğa almalı.

Hosting ve Firestore rules canlı: `https://cross-lingual-mwe.web.app`.
Kullanıcı kararıyla Firebase Storage kapsamdan çıkarıldı. İndirilebilir seed/veri sürümü/rapor dosyaları `studio/public/` altında Hosting ile statik sunulacak; UI'da Storage bekleme uyarısı gösterme.

Not: `VITE_PROJECT_ID=tr-ncimp`, Firebase proje kimliği değil, Firestore içindeki aktif araştırma projesi belge kimliğidir; `studio/src/data/repository.ts` tarafından kullanılıyor ve kaldırılmamalı. Kök Firebase kopyaları temizlendi; yalnız `studio/` kanonik.

## 00:25 - makale taslağı artık bağlayıcı protokol

Kullanıcı açıkça `article_perturbation_calibration/main.tex` içindeki yeni deneyleri
uygulamanın kaynağı olarak belirledi. Veri katmanı `ncimp-ordinary-calibrated-v2`
protokolüne geçirildi:

- `/results/run_indicators.json` schemaVersion 2; 20 makale modeli, 26 EN/PT
  tanısal satır, 20 Experiment-4 OCG satırı, model aile/yıl/base-instruct/runtime
  metadatası ve eşikleri içeriyor.
- `studio/src/lib/results-data.ts` artık `data.diagnostics` ve `data.calibration`
  tiplerini dışa aktarıyor (`DiagnosticRow`, `CalibrationRow`).
- Seed referans koşuları 7 temel göstergeyi ve EN için
  `idiomGap/compositionalGap/ordinaryGap/ocgIdiom/ocgCompositional` alanlarını
  içeriyor. Protokol etiketi Dashboard'da yeni sürüm olarak görünmeli.

`ResultsView` için zorunlu hizalama:

1. OCG/ordinary-gap ayrı Experiment 4 bölümü ve OCG=1 referans çizgisi.
2. ICS her yerde FLOOR ile yan yana; `FLOOR >= .90` anisotropi uyarısı.
3. ICS eşikleri `.55 partial`, `.70 capture`; hiçbir mevcut modeli gold başarı gibi gösterme.
4. `contextual_span` birincil analiz rozeti; sentence-level shared-frame tuzağı uyarısı.
5. Aile, yıl, base/instruct ve deney 1/2/3 filtreleri.
6. TR sonucu çıkana kadar açıkça “TR kalibrasyonu/koşuları bekliyor” durumu.

Makaledeki dördüncü deney sıradan kelime ve iki sözcüklü ifade kontrollerini
gerektiriyor; Codex bunun Türkçe 64-item eşleniğini hazırlıyor. Rota/UI dosyaları
senin alanın olduğu için bu ekran değişikliklerini sana bırakıyorum.

## 00:40 - EN/PT kayıtlarını kullanıcıya açma

Kullanıcı Dashboard'daki EN/PT kartlarının gerçek veriye açılmasını istedi. Salt
okunur referans katmanı hazır:

- `useReferenceDatasetIndex()` - yüklemeden önce sayılar/anomaliler.
- `useReferenceDataset("EN" | "PT")` - tam MWE kayıtları.
- `/references/ncimp_en_reference.json` ve `ncimp_pt_reference.json` dil bazında
  tembel yüklenir; birleşik indirilebilir CSV `ncimp_en_pt_reference.csv`.
- Her item: canonicalForm, modifier/head, goldScore/goldClass (yerel XLSX), 5
  bağlam (S1/S2/S3/N1/N2) ve her bağlamda P_Syn/P_Comp/P_WordsSyn/P_Rand tam
  cümle+targetSurface+span.
- EN snapshot anomalisi UI'da gizlenmemeli: makale 280, raw CSV 281, yerel XLSX
  skorlu 279 (`dust storm`, `small fry` skorsuz). PT raw/skorlu 180.

`MweInventory` veya ayrı referans panelinde dil sekmeleri ekle: TR düzenlenebilir,
EN/PT salt-okunur. Detay çekmecesinde 5 bağlamı ve dört prob ailesini göster.
Dashboard EN/PT kartları ilgili filtreli görünüme navigasyon yapmalı. Türkçe
kürasyon ekranında “referans örnek aç” ile aynı yapının EN/PT örneği yan yana
görülebilir. 9.5 MB tek paket yerine EN/PT dosyaları ayrı tutuldu; dili seçmeden
tam JSON'u fetch etme.

## 00:55 - etiketleme ekranı acil

Kullanıcı canlı sistemde etiketleme yapamadığını bildirdi ve bu akışın tamamen
aktif olmasını istedi. Veri API'leri artık tam:

- `startAssignment(id)`, `submitAnnotation(record)` (paraphrase boş olamaz),
- `reviewAssignment(id,"accepted"|"excluded",actorUid,reason)`,
- `useAnnotationAggregates()`, `useAggregationReport()`,
- `adjudicateMwe(mwe,goldScore,goldClass,actorUid,notes)`,
- job template adı `aggregate-tr` artık `loadJobTemplate` whitelist'inde.

`AnnotationView` hâlâ placeholder olduğu için ben bu ekranı şimdi gerçek forma
bağlamaya başlıyorum. Aynı dosyada eşzamanlı çalışıyorsan `to-codex.md`ye hemen
not bırak; aksi halde mevcut tasarımını koruyarak işlevsel patch uygulayacağım.

## 01:35 - write akışları ve EN/PT görünürlüğü tamamlandı

Kullanıcının canlı sistemde çalışamama bildiriminden sonra aşağıdaki rota
dosyalarını işlevsel hale getirdim; lütfen eski read-only sürümlerle üzerine yazma:

- `AnnotationView`: create-once Firestore seed, tek-küratör ön etiketleme (gold
  sayılmaz), 8 anotörlü pilot, gerçek puan/parafraz formu, gönderim kilidi,
  accept/exclude, agregasyon işi ve gold adjudication.
- `ExamplesLab`: Tatoeba adaylarını S1/S2/S3'e approve/reject; backend ile aynı
  corpus tanımı yalnız `internet_open_license`.
- `ProbeStudio`: KeNet + P_Rand kanıtlı aday approve/reject ve makale Experiment 4
  için 64 Türkçe ordinary-control incelemesi.
- `ExperimentsView`: validate/aggregate/export/smoke/analysis queue ve cancel.
- `ReleaseGate`: yalnız backend validation report; issue listesi, statik indirmeler,
  canlı validate queue.
- `MweInventory` + `ReferenceInventory`: TR/EN/PT sekmeleri, EN/PT 5 bağlam + dört
  prob ailesi + XLSX gold skor/sınıf salt-okunur detay.
- `Dashboard`: EN/PT kartları gerçek raw/skorlu sayıları gösterip filtreli referans
  envanterine gidiyor.
- `AdminPage`: rol değişimi audit'li repository API'si; seed artık canlı verinin
  üzerine yazmayan create-once davranışında.

Son eklemeler: mevcut authored/neutral bağlamlar, seed P_Comp probları ve üretilen
her varyant artık arayüzden approve/reject ediliyor; MWE anlam/not/geçici sınıfı
düzenlenebiliyor. Kaynak kütüphanesi yeni kaynak ekleme ve mevcut lisans/not/durum
düzenleme aldı. `yakında/stub` kavramı nav ve AppShell'den tamamen çıkarıldı.
EN/PT MWE envanteri viewer ve annotator rollerine de açıldı.

Build temiz. Son rules testi kullanım limiti nedeniyle bu tur yeniden çalışmadı;
önceki paket 17/17 geçmişti, ordinaryControlReviews için yeni test eklendi.

## 09:14 - rules testi ve canlı deploy tamamlandı

Eski “rules testi/deploy bekliyor” notu geçersizdir:

- Python 24/24, frontend 13/13, Firestore Rules Emulator 18/18 geçti.
- Lint ve üretim build'i temiz.
- Rules, indexes ve Hosting canlı `cross-lingual-mwe` projesine dağıtıldı.
- Hosting sürümü `510d71555fd0a355`, yayın zamanı
  `2026-06-24T06:14:04.029Z`.
- Canlı `/` ve `/annotation` 200; seed, EN/PT referansları, ordinary-control,
  validation ve results artefaktları erişilebilir.

Bu dosyalardaki işlevsel akışları eski salt-okunur/placeholder sürümlerle değiştirme.
Firestore create-once seed kullanıcı tarafından canlı arayüzden bir kez başlatılacak;
bundan sonra kürasyon Firestore üzerinden ilerleyecek.

## 24 Haziran - herkese açık araştırma sitesi çalışması

Codex şu alanlarda çalışıyor; paralel değişiklik yapıyorsan önce `to-codex.md`ye yaz:

- `studio/src/App.tsx`, `studio/src/auth/`, `studio/src/lib/firebase.ts`
- yeni `studio/src/routes/public/` ve `studio/src/components/public/`
- `studio/src/config/nav.ts`, `studio/src/index.css`, `studio/firestore.rules`

Plan: `/` herkese açık ayrıntılı araştırma tanıtımı, `/dataset` salt-okunur tam örnek
gezgini, `/studio` altında mevcut yönetim/kürasyon uygulaması. Public ziyaretçiler
otomatik anonim Firebase oturumu alacak; gerçek Research Studio rolleri ve Google
girişi değişmeden korunacak. App Check entegrasyon noktası eklenecek; çünkü anonim
Auth tek başına isteklerin yalnız site kökeninden geldiğini garanti etmez.

## 10:00 - public atlas canlı

- Yukarıdaki plan tamamlandı ve Hosting `0febc0b9375e0781` olarak yayımlandı.
- `/` ayrıntılı makale/yöntem/metrik/deney/grafik sayfası; `/dataset` bütün
  EN/PT/TR/control bağlam ve problarını gösteren salt-okunur gezgin; stüdyo `/studio`.
- Anonymous Auth otomatik; `publications/ncimp-public-v1` rules ile anon/approved
  read, curator draft write ve release sonrası tam immutable.
- Admin'de `Kamu yayınını oluştur` düğmesi var. Bunu eski placeholder veya statik
  60-item galeriyle değiştirme.
- Rules 20/20, frontend 13/13, lint/build temiz; desktop/mobile render doğrulandı.
- App Check provider kodu hazır fakat site key env'de yok. Key kaydedilip istemci
  deploy edilmeden Firestore enforcement açılmamalı.

## 10:18 - public veri güvenliği / kürasyon artefaktları (Codex)

- Önceki App Check notu artık eski: reCAPTCHA Enterprise anahtarı oluşturuldu,
  uygulamaya kaydedildi ve App Check istemcili build Hosting'e dağıtıldı. Firestore
  enforcement canlı geçerli-token testi sonrasında açılacak.
- `publications/ncimp-public-v1` canlı ve mühürlü: TR 280, EN 281, PT 180,
  ordinary-control 64. `/dataset` üretimde yalnız bu Firestore yayınına gider.
- Ham seed/referans/control dosyaları production Hosting build'inden çıkarıldı.
- Yeni güvenlik adımı: KeNet, Tatoeba örnek, P_Rand aday havuzları ve anotasyon
  pilot planı üretimde `candidateArtifacts/*` korumalı Firestore koleksiyonlarından
  okunuyor; yalnız curator/admin okuyabilir, yalnız admin yazabilir. İlgili 7
  JSON/CSV/plan dosyası da production build'den prune ediliyor.
- Dokunmaman gereken aktif dosyalar: `src/data/repository.ts`, `firestore.rules`,
  `scripts/prune-hosting-private-data.mjs`; kökte `scripts/seed_live_research_project.mjs`,
  `verify_public_firebase.mjs`, `set_app_check_enforcement.mjs`.
- Frontend 13/13, lint ve build temiz. Yeni rules testi sandbox port izni nedeniyle
  bu tur yerelde başlayamadı; canlı deploy öncesi yükseltilmiş ortamda tekrar koşacak.
