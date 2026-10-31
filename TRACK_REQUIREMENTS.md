# Dividend Bond — şartlar ve gerçek kanıt

Yalnız **API3** seçilidir. Teknik akış çalışır; yarışma paketi video ve Devfolio gönderimi tamamlanmadan bütün submission şartlarını karşılıyor diye sunulmaz.

## Güncel resmî kontrol

- Başlangıç:31 Ekim2026 **03.39 Europe/Berlin**. Browser'da gerçek API3 tab'ı seçilip tüm bölüm, submission, judging, examples ve context açıldı; genel How to submit tab'ı ayrıca okundu.
- Bitiş:31 Ekim2026 **03.56 Europe/Berlin**. Aynı sekmeler yeniden açıldı; maddi değişiklik görülmedi. `evidence/rules-recheck.json`.
- Track:https://hackathon.tum-blockchain.com/prizes#api3
- Genel:https://hackathon.tum-blockchain.com/prizes#how-to-submit
- Starter:https://github.com/api3dao/airnodehub-hackathon-starter — kaynak commit52933ae1fb9371446a927338473466c3d320e19a.
- Recommended:https://api3dao.github.io/airnodehub-hackathon/docs/integrations#recommended-for-the-hackathon — EODHD önerilen finance listing'idir.
- Guide:https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract
- Projection:https://api3dao.github.io/airnodehub-hackathon/docs/projections
- Listing:https://airnodehub.api3.org/explore/eodhd ; canlı metadata:https://airnode-eodhd.fly.dev/

Sponsor başlığı **API3 / Any API in your contract** olarak görüldü. Default BSV tab'ının şartları aktarılmadı. Genel deadline **31 Ekim2026 15.00 Europe/Berlin**, takım başına **tek** Devfolio başvurusu ve en fazla üç partner track. Bu repo ayrı ürün teslimidir; yedi ayrı yarışma başvurusu yapma yetkisi veya uygunluğu iddia edilmez.

## Zorunlu teknik qualification

| Madde | Uygulama | Gerçek kanıt | Durum |
| --- | --- | --- | --- |
| AirnodeHub verisi çekirdek iş için gerekli | İmza/policy geçmeden rezervden claim yok; admin bypass yok | contracts/DividendBond.sol; test/RealEodhdProof.t.sol | PASS |
| Deployed contract signer/request/time kontrol eder | Sabit EODHD signer, canonical request,300s age,60s future skew; exact dates ve USD | evidence/deployment.json, evidence/request-manifest.json; Base Sepolia0x4b6a7feb8f0e9bb1ba51ad7921f352e0a4ee6e5b | PASS |
| Exact signed değer anlamlı state/action yaratır | .26USD×100 =26tdUSD beneficiary payout; Claimed state | evidence/collection.json; claim0xf4419dba4bdd1f320074257d4f618bf7120136ab563c251c417b4218edc7acd3 | PASS |
| Duplicate action koruması | Tek claim state; persisted intent/tx receipt reconcile | evidence/acceptance.json; double-claim contract testleri | PASS |
| Gerçek, zamanında valid response intended action yapar | Agent x402 veriyi alır, deploy edilmiş verifier kontrol eder, claim broadcast eder | collection.json response+confirmed receipt+26e6 bakiye farkı; tamper-live.json validCase | PASS |
| Edited gerçek response reddi | Tutar değiştirilir, gerçek eski imza korunur | evidence/tamper-before-claim.json:Active claimFor eth_call; tamper-live.json; real fixture test | PASS |
| Gerçek stale response reddi | Timestamp değiştirilmeden300s üstüne yaşlandı | Aynı dosyalar ResponseTooOld; gerçek fixture +301s test | PASS |
| Başka gerçek request reddi | Aynı EODHD signer'ın ücretsiz searchInstruments imzası | test/fixtures/real-eodhd-wrong-request.json; active claimFor NotSignedByAirnode | PASS |
| Yanlış signer reddi | Açıkça public local-test key ile negatif proof | tamper-before-claim.json, tamper-live.json, contract testleri | PASS |

Canlı tamper reddi kanıtları **salt okunur eth_call simülasyonlarıdır**, broadcast edilmiş revert işlemleri değildir. Active entry point'in exact calldata'sı action öncesi reddedildi; rezerv50e6/beneficiary0/stateActive aynı kaldı. Sonraki rapor claim tüketildikten sonra proof policy'yi validateResponse ile test eder; InvalidState hatası gerçek proof hatasını maskelemez. Başarılı payout ayrı gerçek broadcast transaction'dır. Yerel contract testleri aynı reddin state/fund invariant'ını da doğrular.

## Zorunlu track teslimleri

| Madde | Kanıt/teslim | Durum |
| --- | --- | --- |
| Contract adresi ve network | README, evidence/deployment.json; Base Sepolia84532 | PASS |
| Jürinin kendi response'unu sunabilmesi | UI raw-envelope form; npm run submit-response -- response.json; permissionless claimFor ABI | PASS |
| Veri kullanıcıları/sahte veri etkisi/bulunamayan veri açıklaması | README ve SUBMISSION_DRAFT.md; broker ownership/backing mevcut değil | PASS |
| Videoda valid action ve dört tamper reddi | Gerçek kanıtlar ve PRESENTATION.md150s outline hazır; video dosyası kaydedilmedi | PENDING |

## Genel zorunlu teslimler

| Madde | Kanıt/teslim | Durum |
| --- | --- | --- |
| Public repo | https://github.com/ABerkeBora/heka-dividend-bond ; create doğrulandı, source push son teslim doğrulamasında kaydedilir | PENDING |
| Setup/run README | README.md, .env.example, package-lock.json, artifacts/, vendored Solidity libs | PASS |
| Ayrıntılı Devfolio açıklaması | SUBMISSION_DRAFT.md hazır; Devfolio formuna gönderilmedi | PENDING |
| En fazla2.5dk video | PRESENTATION.md yalnız outline'dır; kayıt gerekir | PENDING |
| Deadline öncesi kullanıcı submission'ı |31 Ekim2026 15.00 Berlin; bu görevde submission yapılmadı | PENDING |

## Kullanıcının agentic-payment şartı — resmî track'ten ayrı

| Şart | Gerçek kanıt | Durum |
| --- | --- | --- |
| Tek ilk yetki sonrası ekonomik agent eylemi | Desktop bond-01 ve phone bond-02 authorize→external aUSD data fee→permissionless claim→beneficiary payout; collection.json | PASS |
| Integer caps,expiry,allowed tool/asset/payee/contract/beneficiary | server/config.ts, payment.ts, agent.ts; collection.json mandate | PASS |
| Over-budget veya wrong-recipient blok | acceptance.json:validator REJECT,broadcastfalse,bakiyeler aynı | PASS |
| Duplicate/process restart yeni ücret veya payout yaratmaz | acceptance.json; aynı process ve yeni Node process; aUSD/nonce/payment-intent/payout aynı | PASS |
| Unknown payment rezervasyonu/recovery |64 server testi; nonce/receipt+raw response recovery; live crash charge senaryosu taklit edilmedi | PASS |
| Veri ücreti/gas/teminat ayrı | Customer .005aUSD; claim actual1690194002005wei;26tdUSD payout+24tdUSD issuer surplus | PASS |

Mandate ve API spending limitleri **uygulama kodunda**; izole test wallet güven sınırı var. On-chain enforce edilenler signer/request/timing/event/cap/immutable beneficiary/oneclaim'dir. L2 gas/maxFee bound transaction'dadır; ek L1 ücretinin mutlak cap'i yok, marjlı tahmin ve receipt muhasebesi vardır. Bu sınırlar daha güçlü bir session-key/on-chain spending sistemi gibi sunulmaz.

## Kaynak ve tasarım doğrulamaları

- `evidence/event-discovery.json`:aynı parametrelerle ayrı imzalı ham array tam1kayıt. bond-02 bundan sonra deploy/fund edildi. `/0` keyfî belirsiz kayıttan seçilmedi.
- EODHD ex-date ve unadjustedValue semantiği metadata ve gerçek cevapla doğrulandı. Ayrı upstream updatedAt yok; taze envelope tarihsel kaydın değişmezliğini garanti etmez.
- İmza upstream doğruluğu, gerçek hisse sahipliği veya backing ispatı değildir. LLM settlement authority yok; deterministik bounded agent.
-64 server testi,36 contract testi ve256 fuzz koşusu, TypeScript ve production build geçti. Dependency audit0vulnerability.
- CUA gerçek browser desktop1440,tablet768,phone390:no horizontal overflow;11px altı görünür metin yok. UI authorization,pending,confirmed,invalidJSON,editedproof,recovery ve receipt reconcile kontrol edildi. evidence/screenshots ve browser-layout.json.

## Jüri tercihleri — zorunlu örneklerden ayrı

Gerçek ihtiyaç, verinin merkezde olması, teknik icra ve özgünlük; agent'ın veri seçimi, gerektiğinde x402 ödemesi ve on-chain eylemi tekrarlanabilir akış olarak değerlendirilir. Belirli örnek fikri veya LLM kullanımı zorunlu değildir. Bu ürün bounded deterministic collection yapar; yeni trusted API listing'i, broker sahipliği veya özel oracle ağı oluşturduğunu iddia etmez.

Açık submission işleri MORNING_HANDOFF.md'ye taşınır. Teknik PASS, tamamlanmış yarışma başvurusu anlamına gelmez.
