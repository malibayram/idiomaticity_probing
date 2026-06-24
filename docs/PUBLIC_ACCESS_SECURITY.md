# Kamu veri erişimi ve App Check

## Mimari

| Veri katmanı | Yol | Okuma | Yazma |
|---|---|---|---|
| Mühürlü kamu yayını | `publications/ncimp-public-v1/**` | Anonymous Auth veya onaylı kullanıcı | Yalnız draft aşamasında curator/admin |
| Canlı Türkçe kürasyon | `projects/tr-ncimp/**` | Onaylı kullanıcı | Curator/admin |
| KeNet/Tatoeba/P_Rand aday havuzları | `candidateArtifacts/**` | Curator/admin | Admin |
| Kör anotasyonlar | `assignments`, `annotations` | Atama sahibi veya curator/admin | Sahiplik ve immutable-submit kuralları |
| Audit olayları | `auditEvents` | Admin | Oturum sahibi adına append-only |

Kamu ziyaretçisi `/dataset` açıldığında otomatik Firebase Anonymous Auth oturumu
alır. İstemci yalnız `publications/ncimp-public-v1` altındaki mühürlü snapshot'ı
okur. TR kürasyon projesi, aday havuzları ve işaretleyici cevapları bu yoldan
erişilemez.

## Canlı kamu snapshot'ı

`scripts/provision_public_firebase.mjs` mevcut Firebase CLI OAuth oturumuyla şu
işleri idempotent biçimde yapar:

1. reCAPTCHA Enterprise ve Firebase App Check API'lerini etkinleştirir.
2. Yalnız `cross-lingual-mwe.web.app` ve
   `cross-lingual-mwe.firebaseapp.com` alan adlarını kabul eden score-based web
   anahtarını oluşturur/kullanır.
3. Web uygulamasını App Check'e kaydeder.
4. TR 280, EN 281, PT 180 ve CTRL 64 kaydı Firestore'a yazar.
5. Yayını `released` olarak mühürler.

reCAPTCHA site key istemci tanımlayıcısıdır, secret değildir; yine de `.env.local`
repoya alınmaz. OAuth access/refresh tokenları script çıktısına veya diske yazılmaz.

## Production Hosting politikası

`npm run build`, Vite çıktısından aşağıdaki ham veri ailelerini otomatik kaldırır:

- TR seed ve draft dataset,
- EN/PT tam JSON ve birleşik CSV,
- ordinary-control JSON/CSV,
- KeNet, Tatoeba örnek ve P_Rand aday JSON/CSV'leri,
- anotasyon pilot planı.

Küçük yöntem özeti, sonuç göstergeleri ve doğrulama raporu kamu araştırma
sayfasında açıklanmak üzere statik kalır. Tam yayımlanmış örnekler Anonymous Auth
+ App Check ile Firestore'dan; kürasyon adayları ise yalnız yetkili
`candidateArtifacts` koleksiyonundan okunur.

## App Check durumu ve enforcement sırası

App Check anahtarı oluşturulmuş, Firebase'e kaydedilmiş ve istemci sağlayıcısı
canlı build'e eklenmiştir. Firestore enforcement şu sırayla açılır:

1. Canlı `/dataset` isteğinin `Firestore release` kaynağıyla yüklendiğini doğrula.
2. App Check metriklerinde geçerli istekleri kontrol et.
3. `node scripts/set_app_check_enforcement.mjs --enforce-firestore` çalıştır.
4. Yayılım sonrasında site içi okumayı ve App Check tokensız anonim REST isteğinin
   401/403 döndürdüğünü doğrula.
5. `node scripts/verify_public_firebase.mjs --strict` ile bütün kapıları denetle.

Enforcement doğrulanmadan önce açılmaz; aksi halde kamu veri gezgini ve Research
Studio aynı anda Firestore erişimini kaybedebilir.

## Güvenlik sınırı

Anonymous Auth tek başına “yalnız bu site” garantisi vermez; Firebase web
yapılandırması doğası gereği istemcide görünür. App Check, izinli alan adında
üretilmiş geçerli attestation tokenı olmayan otomatik/REST isteklerini engeller ve
suistimali ciddi biçimde zorlaştırır.

Bu bir DRM veya gizlilik katmanı değildir: kamu gezgininde gösterilen veriyi
meşru bir ziyaretçi tarayıcı geliştirici araçlarıyla inceleyebilir. Amaç, ham
dosyaları anonim statik URL'lerle yayımlamamak ve Firestore okumalarını
kimliklendirilmiş, attested ve oranlanabilir bir kanala taşımaktır.

Resmi belgeler:

- https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
- https://firebase.google.com/docs/app-check/enable-enforcement
- https://firebase.google.com/docs/auth/web/anonymous-auth
