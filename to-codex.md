# Claude → Codex

**Güncelleme:** 23 Haziran 2026, ~23:35 Europe/Istanbul

Kullanıcı bu turda Firebase init/rules/hosting işini bana verdi ("direkt projeyi
ilklendirip, firebase rule, hosting gibi şeyleri de yapabilirsin"). Aşağıdaki
durumu senin de bilmen için yazıyorum.

## Yaptıklarım

- `studio/` kökünden canlı `cross-lingual-mwe` projesine **deploy ettim:**
  `firebase deploy --only firestore:rules,firestore:indexes`.
  - Kurallar zaten güncelmiş ("already up to date") - demek sen de deploy etmişsin.
  - Indexler (`assignments`, `annotations` composite) yeni yüklendi.
- Storage deploy denedim → "Storage has not been set up". Sonra fark ettim ki
  **Storage'ı bilinçli kaldırmışsınız** (docs + firebase.json + firebase.ts).
  Storage kurmayı denemeyeceğim.

## Senin halletmen iyi olur (çakışmamak için ben dokunmuyorum)

1. **Çift firebase config.** Hem repo kökünde (`./firebase.json`, eski
   `./firestore.rules`, `./storage.rules`, `./firestore.indexes.json`) hem de
   `studio/` içinde config var. Kanonik = `studio/` (orada `.firebaserc` →
   cross-lingual-mwe ve bootstrap'lı doğru kurallar). **Kök kopyalar bayat ve
   tehlikeli** (kökten deploy edilirse eski kurallar yüklenir). Bunları sen
   oluşturdun; silmeyi sana/kullanıcıya bırakıyorum.
2. **Ölü `storage.rules`.** Storage kaldırıldığı için `studio/storage.rules`
   (ve kökteki) artık kullanılmıyor - temizlenebilir.
3. **`studio/firestore.rules` uyarısı:** `role()` helper'ı kullanılmıyor
   ("Unused function: role"). Rules senin alanın; istersen sil.
4. **`studio/.env.local` satır 8:** `VITE_PROJECT_ID=tr-ncimp` kullanılmayan
   bir artık (kod `VITE_FIREBASE_PROJECT_ID=cross-lingual-mwe` okuyor). Zararsız.

## Bootstrap admin - teyit

`studio/firestore.rules` `isBootstrapAdmin()` + `AuthProvider` `initialRole`
mantığını gördüm ve benimsedim: `malibayram20@gmail.com` ilk girişte `admin`
olarak self-create ediyor. `/users/{uid}` schema'sı sabit:
`{ uid, email, displayName, photoURL, role, schemaVersion:1, createdAt, updatedAt }`.

## Hosting

Hosting config `studio/firebase.json`'da hazır (`public: "dist"`). Henüz
**deploy etmedim** - statik veri/seed dosyalarını sen hosting'e koyacaksan,
hosting deploy'unu seed hazır olunca birlikte yapalım. Schema/path değişikliği
gerekirse buraya yazarım.

## Benim devam alanım

`studio/src/routes/` ekranları, `studio/src/components/`, `studio/src/config/nav.ts`,
erişilebilirlik/responsive.

## Yeni: senin data sözleşmene bağımlı ekranlar (şemayı habersiz değiştirme)

`studio/src/data/{schema,hooks,repository}.ts` sözleşmeni kullanmaya başladım:

- **MWE envanteri** (`routes/MweInventory.tsx`) ve **Dashboard** artık
  `useResearchSnapshot()` + `MweRecord` tüketiyor (firestore → bundled fallback;
  `origin` rozetini gösteriyorum).
- Bağımlı alanlar: `mwes[].{canonicalForm,modifier,head,provisionalClass,goldClass,
goldScore,workflowStatus,meaning,notes,contexts[].{slot,family,sentence,targetSurface,span}}`,
  ayrıca `project.{targetMweCount,targetSentenceCount,protocolVersion}`, `sources`, `campaigns`.
- `schema.ts`'te alan adı/yapı değişikliği yaparsan buraya yaz; ekranları hemen hizalarım.
- `ACTIVE_PROJECT_ID = VITE_PROJECT_ID || "tr-ncimp"` - `.env.local`'daki
  `VITE_PROJECT_ID=tr-ncimp` **kullanılıyor** (önceki notumda "artık" demiştim, düzeltiyorum).

Firestore'a seed'i yükleyince ekranlar otomatik olarak `origin: firestore`'a geçecek.

## Durum (23 Haz ~23:45) - tüm modül ekranları canlandı

Stub kalmadı (yalnız `/annotation` ve `/examples` placeholder; write akışları):

- ✅ Dashboard (gerçek sayılar), MWE envanteri, Kaynak kütüphanesi
- ✅ Sonuçlar (ECharts), Prob stüdyosu, Doğrulama & yayın (canlı gate), Deneyler
- ✅ Yönetim: `/users` rol atama + **senin `seedResearchProject` butonun** ekli.
  Admin'den "Seed yükle" → `loadBundledSeed()` + `seedResearchProject(snapshot, uid)`.
  Sen tetiklersen Firestore dolar; bende ekstra işe gerek yok.

Notlar sana:

- `ResultsView` `tslib`'i bağımlılık olarak gerektirdi (`echarts-for-react`); ekledim.
- Ekranlar `RunRecord.{ics,floor,rho,level,language,model,context}`, `JobRecord`,
  `probeCandidateSchema.{kind,lexicalForm,source,reviewStatus,rank}` alanlarını okuyor.
- `ReleaseGate` "korpus örneği" kapısını `provenance.origin != 'authored_for_dataset'`
  ile sayıyor; senin validator'ında farklı bir tanım varsa söyle, hizalarım.
- Performans: route'lar `React.lazy` ile bölündü; ana bundle ~865 kB.

Sırada bende: `/annotation` görev ekranı (assignment akışı) ve `/examples`
laboratuvarı - bunlar için canlı Firestore assignment/annotation sözleşmen
netleşince ilerleyeceğim; aksi halde bundled snapshot ile salt-okunur başlarım.

## YENİ (24 Haz): Sonuçlar sayfası gerçek deneylerle zenginleştirildi

Kullanıcı "tüm deneyleri ekle + sayfayı çok detaylandır" dedi. Seed'deki 24 referans
koşusu yalnız ics/floor/rho içeriyordu; gerçek deneyler `runs/*/indicators.csv`'de
**7 göstergeyle** (ISC, IG, LOD, AID, FLOOR, RHO, ICS) duruyordu.

Yaptıklarım (senin `src/data` ve `public/seed/`'ine **dokunmadan**):

- `scripts/build_results_dataset.py` → `studio/public/results/run_indicators.json`
  (19 deney, 58 ölçüm, 21 model, modelType=embedding/llm/small-baseline/other).
- `studio/src/lib/results-data.ts` (`useRunIndicators()` + zod) - yeni, ayrı veri yolu.
- `ResultsView` baştan yazıldı: model bar grafiği, model×7-gösterge **ısı haritası**,
  gösterge×gösterge **scatter** (model tipine göre renkli), filtreli/sıralı tam tablo,
  metrik açıklama lejantı. Artık seed `runs`'ına bağlı değil.

**Koordinasyon / öneri:**

1. Bu "results" verisi seninle çakışan ikinci bir kaynak olmasın istiyorum. İdeali:
   `build_research_studio_seed.py` (veya senin worker export'un) bu indicator setini
   üretsin/sahiplensin. İstersen `runSchema`'yı 7 göstergeyle + `modelType` +
   `nIdiomatic` ile genişlet; ben `ResultsView`'i tekrar `useResearchSnapshot`'a
   bağlarım ve `results-data.ts` + script'i kaldırırım. Karar sende.
2. Eksik deneyler: şu an yalnız **EN/PT, nc** var. **TR koşuları** ve **cümle (sentence)
   seviyesi** indicator'ları üretirsen sayfa otomatik gösterir (UI hazır, `level`/`lang`
   filtreleri mevcut). `runs/`'a yeni deney eklenince script'i tekrar çalıştırmam yeterli.
3. `summary.json`'daki sim/affinity (sim*P_Syn/Comp/WordsSyn/Rand, aff*\*) ölçümlerini de
   ileride ekleyebilirim (per-prob dağılımları); şimdilik 7 indicator ile başladım.

## GÜNCEL (24 Haz): v2 şemanı tükettim - ResultsView makaleye hizalandı

`build_results_dataset.py` + `results-data.ts` schemaVersion 2 sürümünü (sen yazdın)
gördüm ve `ResultsView`'i baştan ona göre kurdum. **`results-data.ts` ve script artık
senin**; ben yalnız tüketiyorum, dokunmuyorum.

Bağımlı olduğum v2 alanları (değiştirirsen UI'ı hizalarım):

- `thresholds.{icsPartial,icsCapture,floorWarning,ocgBaseline}` - eşik çizgileri + ana bulgu.
- `diagnostics[].{model,language,family,studyExperiment,representationLevel,isc..ics,anisotropyWarning}`
  - sıralama grafiği + ısı haritası (dil/aile/deney filtreli).
- `calibration[].{model,idiomGap,compositionalGap,ordinaryGap,ocgIdiom,ocgCompositional,unstable,warning}`
  - Deney 4 OCG paneli + tablo.
- `indicators[].{model,modelType,lang,context,studyExperiment,representationLevel,isc..ics}`
  - scatter + tam tablo.
- `methodNotes`, `protocolVersion`, `studyModelCount`, `runCount`.

Doğrulama: tsc/lint/build temiz; JSON v2 yükleniyor (20 model, OCG_idiom max 0,68);
hosting'e deploy edildi. TR/sentence koşuları `runs/`'a girince script'i çalıştırıp
deploy etmem yeterli - UI hazır.

İstek: `diagnostics`/`indicators`'a **TR** satırları ve **sentence** seviyesi
eklersen filtreler otomatik dolar. OCG için TR control set'i (64 örnek) curate edilince
`calibration`'a TR satırı da gelebilir.

## GÜNCEL (24 Haz): Public tanıtım sayfası (Landing) + /studio uzlaşması

Kullanıcı herkese açık, detaylı bir tanıtım sayfası istedi. Yaptıklarım (rota/bileşen = benim alanım):

- **`studio/src/routes/Landing.tsx`** (yeni): `/` public showcase. Statik public veriden
  okur (`/seed/tr_project.json` + `/results/run_indicators.json`) - auth gerektirmez.
  İçerik: hero+istatistik, projenin amacı (4 prob türü), grey matter vs economic aid
  örnek tabloları, 7 metrik + OCG (örnekli), 4 deney, ana bulgu, **OCG ECharts grafiği**
  (taban 1.0), ve **aranabilir salt-okunur örnek galerisi** (280 MWE × 5 bağlam, span
  vurgulu). Build/lint/preview temiz, deploy edildi.

- **`App.tsx` uzlaşması:** Senin nav.ts'i `/studio/*`'a, ProtectedRoute/LoginPage'i
  `/studio`'ya taşıdığını gördüm ama App.tsx hâlâ flat path'teydi (tutarsız/kırık).
  App.tsx'i senin `/studio` kararına göre yeniden yapılandırdım:
  `/` = Landing (public), `/studio` = Dashboard (index), `/studio/{annotation,results,
mwes,sources,examples,probes,release,experiments,admin}`. LoginPage/ProtectedRoute'a
  DOKUNMADIM (zaten `/studio`'ya yönlendiriyorlar - doğru). Aynı anda App.tsx'i
  düzenliyorsan burada uzlaşalım; benim sürümüm nav+auth ile tutarlı.

- Landing, senin eklediğin **`isAnonymous`** alanını kullanıyor: anonim ziyaretçiye
  "Google ile giriş", onaylı kullanıcıya "Stüdyoya gir", pending'e "Onay bekliyor".

### Açık koordinasyon - anonim okuma kuralları (senin alanın: firestore.rules)

Anonim giriş canlıda çalışıyor (provider açık; anon sign-in başarılı). Kullanıcı
"Firebase'deki salt-okunur veriler anon auth ile okunabilsin, tamamen açık olmasın"
dedi. Şu an:

- Landing **statik public dosyalardan** okuyor (anon'a gerek yok ama dosyalar dünyaya açık).
- `/studio` ekranları Firestore'dan okuyor; anon `/studio`'ya giremiyor (ProtectedRoute).

Eğer Firestore'daki read-only koleksiyonları anon'a açmak istiyorsan (proje/mwes/
sources/runs/diagnostics), `request.auth != null` ile read izni gerekir (yazma kapalı).
Bu senin reserved `firestore.rules` alanın - ben dokunmadım. İstersen Landing'i de
statik yerine anon-Firestore okumaya çeviririm; kararı/rule'u sana bırakıyorum.

## DÜZELTME (24 Haz, sonraki tur): Landing'i SEN yapmışsın - benimkini sildim

Yukarıdaki "Landing.tsx yaptım" notu artık geçersiz. Aynı anda ikimiz de public
landing kurmuşuz. Sen `routes/public/ResearchLanding.tsx` (`/`) + `PublicDataset.tsx`
(`/dataset`) yapmışsın - daha şık ve tam. **Seninkine uydum:**

- Kendi `routes/Landing.tsx`'imi **sildim** (orphan'dı, App.tsx seninkini import ediyor).
- App.tsx `/studio` yapısında yakınsadık; LoginPage/ProtectedRoute'a dokunmadım.
- Codex'in ResearchLanding'ini build edip **hosting'e deploy ettim** (canlı).

### `/dataset` anon okuma kırık - senin alanın (rules DOĞRU, eksik = veri yayını)

`/dataset` sayfası canlıda **"Missing or insufficient permissions" + 0/0 kayıt** veriyor.
Tanı: kuralların zaten doğru - `/publications/**` için `isAnonymousSession() || isApproved()`
okuma izni var. Sorun:

1. PublicDataset muhtemelen `/projects/{id}` (anon'a KAPALI) üzerinden `useResearchSnapshot`
   ile okuyor → permission denied. Anon okuması için `/publications/**`'tan okumalı; VEYA
2. `/publications`'a henüz **yayınlanmış snapshot yok** (publish adımı çalışmamış).

Bu tamamen senin alanın (rules + publications + PublicDataset data yolu). Ben rules'a
ve PublicDataset'e dokunmadım. Çözüm muhtemelen: admin "yayınla" aksiyonu /
seedResearchProject benzeri bir fonksiyonun `/publications/{id}` altına public snapshot
yazması. Yazınca `/dataset` anon ile otomatik okur (rules hazır).

Public `/` landing statik (`/seed`,`/results`) okuduğu için sorunsuz çalışıyor.

## QA (24 Haz): public-publication sistemini doğruladım - sağlam ✅

Sen `lib/public-publication.ts` + AdminPage "Yayınla" + provision/verify scriptlerini
kuruyordun; hot dosyalarına DOKUNMADIM, sadece dışarıdan QA yaptım:

- **Build/lint temiz.** Mid-edit hâli derleniyor.
- **Publish bağımlılıkları tam:** `/seed/tr_project.json`, `/references/ncimp_en_reference.json`
  (281), `/references/ncimp_pt_reference.json`, `/controls/turkish_ordinary_control.json`
  (64 öğe, `item_id`). Hepsi mevcut → `publishPublicResearchDataset` ve DEV bundled yolu çalışır.
- **`/dataset` DEV'de çalışıyor** (önceki turda "Missing or insufficient permissions"
  görmüştüm; senin `loadPublicDataset` DEV→bundled düzeltmen sorunu çözmüş): EN sekmesi
  281/281 kayıt, gold skor/sınıf, dil sekmeleri, "Anonim Firebase oturumu aktif" rozeti,
  konsol hatasız.
- `commitItems` id seçimi (`item_id` vs `id`), draft→released mühürleme ve rules
  (`/publications/**` anon read) tutarlı görünüyor.

**Kalan (senin/operasyonel):** canlı PROD `/dataset` için admin'in AdminPage'den
**"Yayınla"**'yı çalıştırması (veya `provision_public_firebase.mjs`) → `/publications/
ncimp-public-v1` released olunca anon okuma açılır. Hosting'i bu turda ben tekrar
deploy ETMEDİM (sen aktif düzenliyorsun); hazır olduğunda sen deploy et ya da bana söyle.

Ben karışmadan tamamlayıcı iş yapayım diye sıradaki bağımsız işim: frontend test
altyapısı (Vitest + RTL, saf mantık: roles/SpanText/results-data). Çakışma olmaz.

## GÜNCEL (24 Haz): dil tespiti + işaretleyici başvuru formu

Kullanıcı (1) İngilizce tarayıcıda site TR açılıyor dedi, (2) public başvuru CTA'sı istedi.

**Dil:** `i18n/index.ts`'i sen aktif düzenliyordun; DOKUNMADIM. Mevcut kod zaten doğru —
preview'da en-US tarayıcıda `htmlLang=en`, site İngilizce açılıyor. Sorun eski deploy /
stale localStorage'dı. Güncel build'i deploy ettim; live artık doğru.

**Başvuru (yeni, çakışmasız dosyalar):**
- `routes/public/ApplyAnnotator.tsx` (`/apply`) — bilingual (inline EN/TR), küçük form:
  ad, e-posta, ana dil, Türkçe seviyesi, geçmiş, motivasyon.
- `lib/annotator-application.ts` — `submitAnnotatorApplication()` → `/annotatorApplications`
  (anon oturumla create).
- `App.tsx`: `/apply` public route eklendi.
- `firestore.rules`: **`/annotatorApplications` bloğu eklendim** (default-deny'dan önce,
  satır ~262). Senin reformatın bunu korudu (teyit ettim). create: signed-in (anon dahil) +
  submitterUid==uid + status=='new' + ad/e-posta/anadil validasyonu; read/update/delete admin.
  **Rules'ı deploy ettim.** Sen rules'ı tekrar deploy edersen bu blok dosyada zaten var.
- `ResearchLanding.tsx` footer'a "Become an annotator/İşaretleyici ol" → `/apply` CTA
  ekledim (inline i18n, locale dosyasına dokunmadım — locale'ler thrash ediyordu).
- **Uçtan uca test ettim:** anon ziyaretçi formu doldurup gönderdi → "Application received",
  konsol hatasız → `/annotatorApplications`'a yazma canlı kurallarla çalışıyor.
  (Canlıda "Test Applicant" test kaydı oluştu; admin silebilir.)

**Senden rica:** AdminPage'i (hot) sen düzenliyorsun; oraya bir **başvuru inceleme paneli**
(`/annotatorApplications` listeleme + onaylanınca davet/role) eklersen tamamlanır. İstersen
ben de eklerim ama AdminPage'de eşzamanlı çalışıyorsun, çakışmamak için sana bırakıyorum.
