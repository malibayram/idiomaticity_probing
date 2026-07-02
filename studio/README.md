# NCIMP Research Studio

Türkçe NCIMP genişletmesinin kaynak, örnek, anotasyon, prob, ordinary-control,
doğrulama, deney ve sonuç iş akışlarını yöneten React/Firebase uygulaması.
Bağlayıcı protokol `../article_perturbation_calibration/main.tex` ve uygulama
protokol sürümü `ncimp-ordinary-calibrated-v2`dir.

## Yerel çalıştırma

```bash
npm install
npm run dev
```

Firebase istemci ayarları Git dışında tutulan `.env.local` dosyasından okunur.
`VITE_PROJECT_ID=tr-ncimp` Firebase proje kimliği değil, Firestore içindeki aktif
araştırma projesi belge kimliğidir. Firebase Storage kullanılmaz; indirilebilir
artefaktlar `public/` üzerinden Hosting'de statik sunulur.

## İlk kullanım ve etiketleme

1. Bootstrap admin hesabıyla giriş yapın.
2. Anotasyon veya Yönetim ekranında **Firestore'u etkinleştir / Seed yükle**
   düğmesine bir kez basın. İkinci seed canlı veriyi korumak için reddedilir.
3. Hemen kişisel çalışma için `type` veya `token` **ön etiketleme** kampanyası
   başlatın. Ön etiketler gold sayılmaz.
4. Gold pilot için Yönetim ekranında en az iki kullanıcıyı `annotator` rolüne
   alın, Anotasyon ekranından seçip pilotu başlatın.
5. Anotörler 0–5 genel/modifier/head, 1–5 güven ve zorunlu parafrazı gönderir.
   Yanıt immutable'dır.
6. Küratör gönderimleri kabul eder veya gerekçeyle dışlar. Admin **Şimdi agrege
   et** ile tarayıcıda alpha/ICC/CI üretir; uzman gold puan ve sınıfı kaydeder.

## Veri hazırlama akışları

- MWE envanteri: Türkçe anlam/not/geçici sınıf düzenleme; EN/PT salt-okunur
  insan skorlu referanslar.
- Örnek laboratuvarı: Tatoeba adayını S1/S2/S3'e onaylama/reddetme ve mevcut
  authored/neutral bağlamların insan incelemesi.
- Prob stüdyosu: KeNet P_Syn/P_WordsSyn, frekans eşli P_Rand, mevcut P_Comp ve
  üretilen her cümle varyantının dilbilgisi/span incelemesi.
- Experiment 4: 64 Türkçe ordinary-control kaydının ayrı onay kuyruğu.
- Doğrulama: Python validator ile aynı kapılar; 280 MWE, 5 bağlam, iki type ve
  token anotasyonu, gold skor/sınıf, 1/2/5/5 prob, onaylı varyantlar, 64 control
  ve 19.600 cümle.

## Worker

Validate/export/aggregate/experiment/analysis işleri Firestore kuyruğuna yazılır.
Yerel worker için repo kökünde Python bağımlılıklarını ve güvenli ADC/service
account ortamını hazırlayın:

```bash
python3 -m pip install -r requirements-studio.txt
export GOOGLE_APPLICATION_CREDENTIALS=/guvenli/yol/service-account.json
python3 scripts/run_studio_worker.py --project cross-lingual-mwe
```

Servis hesabı dosyasını repoya koymayın. Admin kullanıcı için agregasyon ayrıca
tarayıcı içinde çalışabilir; model deneyleri ve canlı validator worker gerektirir.

## Artefaktları yeniden üretme

Repo kökünden:

```bash
python3 scripts/build_results_dataset.py
python3 scripts/build_ncimp_reference_artifact.py
python3 scripts/build_turkish_ordinary_control.py
python3 scripts/build_research_studio_seed.py
python3 scripts/validate_research_studio_seed.py
```

## Test ve yayın

```bash
npm test -- --run
npm run lint
npm run build
npm run test:rules
firebase deploy --project cross-lingual-mwe --only firestore:rules,firestore:indexes,hosting
```

Kanonik Firebase yapılandırması yalnız bu `studio/` dizinindedir.
