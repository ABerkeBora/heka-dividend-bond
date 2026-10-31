# V2 güven sınırı ve gerçek kanıt incelemesi

İnceleme: 31 Ekim 2026, yaklaşık 04.38 Europe/Berlin. Bu dar kapsamlı kod/kanıt incelemesi bir bağımsız güvenlik denetimi değildir. Contract kodu V1 ile aynıdır; V2 ayrı collateral ve deployment kullanır.

## Issuer ve collector ayrımı

`server/v2-launcher.ts` yalnız izinli komutları ayrı Node.js 24 sürecinde başlatır. Çocuk ortama issuer `WALLET_FILE`, `NODE_OPTIONS` veya parent ortamın tamamı aktarılmaz. Collector ayrı, yalnız `collector` rolünü içeren 0600 test wallet dosyasını okur. Root `.env`, issuer wallet, V1 journal ve V1 deployment evidence okumaları işlemden önce gerçekten `ERR_ACCESS_DENIED` ile reddedilir; child process, worker ve native addon yetkileri kapalıdır.

İlk ekonomik çalıştırmanın kalıcı kanıtı `evidence/v2/collection-runtime.json`: `collectorSecretOnly=true`, `issuerReadDenied=true`, `runtimeRestricted=true`. Collector `0x4d299E20B77a197950cE862b311aB34B4237Fbec`; issuer `0x1e3bD1fD6e463bc410E99298d20274dbE252d6E0`. Setup tamamlandıktan tahsilat bitene kadar issuer nonce **15 → 15**, collector transaction nonce **0 → 1**. Sonraki state/probe çağrıları bu ilk ekonomik kanıtın üzerine yazmaz.

Bu, güvenilen uygulama koduna uygulanmış bir dosya erişim sınırıdır. Aynı işletim sistemi kullanıcısının kontrol ettiği kötü niyetli kod için sandbox veya kriptografik anahtar izolasyonu iddiası yoktur. Node'un [resmî izin modeli açıklaması](https://nodejs.org/docs/latest-v24.x/api/permissions.html) da bu sınırı belirtir. `.local/v2` altında setup'ın onaylanmış raw transaction kayıtları bulunabilir; issuer private key'i burada bulunmaz. API ücret tavanları uygulama guard'ıdır; issuer collateral'ının alıcısı, exact proof policy ve tek payout koruması contract tarafından uygulanır.

## İki farklı nonce ve iki farklı ödeme

`evidence/v2/acceptance.json` içindeki aUSD **EIP-3009 authorization nonce'u** transaction nonce'u değildir. Collector exact 5000 aUSD atomunu izinli EODHD payee'sine yetkilendirir; facilitator bu authorization'ı zincire sunar ve settlement gas'ını öder. Collector'ın aUSD payer olması, settlement transaction'ının `from` adresinin collector olması gerektiği anlamına gelmez.

Gerçek veri ücreti: [0x84a9…e7b3](https://sepolia.basescan.org/tx/0x84a9bd85caec8f0d30974545c56c4633ec1ffe80deef8e34f8928829dabce7b3). Acceptance kanıtı exact `Transfer`, payee, 5000 atom tutarı, authorization owner ve consumed nonce'u doğrular; authorization imzası public evidence'a konulmaz.

Gerçek claim: [0x9dc9…a4d4](https://sepolia.basescan.org/tx/0x9dc93dca56d5c3b5418d9d31f6bc613abebc487897f3a2ce49419c296c6ca4d4). Burada transaction `from` collector'dır, transaction nonce'u **0**, alıcı V2 contract'ıdır. Contract yalnız sabit beneficiary'ye **26 tdUSD** gönderir. Claim gas gideri **1690122001103 wei** olarak ayrıca kaydedilmiştir. API ücreti, claim gas'ı ve issuer rezervinden payout ayrı hareketlerdir. L2 gas sınırı transaction'a konur; Base L1 fee ayrıca tahmin edilir ve toplam gider için sert on-chain tavan iddiası yoktur.

## Retler, tekrarlar ve V1 korunması

`evidence/v2/tamper-before-claim.json`, V2 Active iken actual `claimFor` calldata'sıyla dört ret kontrolünü kaydeder. Gerçek stale cevapta signed timestamp değiştirilmez; farklı request aynı EODHD kaynağından gelen ayrı gerçek cevaptır. Wrong-signer negatif örneğinde açıkça yerel public test anahtarı kullanılır. Bunlar canlı deployed contract'a yapılan **eth_call simülasyonlarıdır**; ret transaction'ı yayınlandığı iddia edilmez. Reserve ve consumed state değişmez. `tamper-live.json` ayrıca başarılı tahsilatın taze gerçek cevabını `validateResponse` ile kabul ettirir; Claimed state'in `InvalidState` kontrolü sahte kanıt testlerini maskelemez.

Acceptance kanıtındaki 14 kontrol PASS: gerçek ilk ödeme ve payout, bütçe/yanlış recipient/expiry retleri ve yeni restricted süreçte retry/recovery sonrası yeni ücret veya ikinci payout olmaması. Belirsiz payment kaydı yeniden yetki üretmeden reconciliation gerektirir. Ödenmiş dış veri ücreti veya yayınlanmış revert gas'ı geri alınabilir gösterilmez.

`scripts/v2-regression.ts` V1'in **32** public evidence dosyasını `v1-baseline` commit'iyle SHA-256 üzerinden karşılaştırır. Son kontrol `evidence/v2/v1-regression.json`: eski Claimed state, **26 tdUSD** payout, sıfır reserve ve beneficiary bakiyesi aynı; eski receipt'ler başarılı. Başlangıç block'undan son kontrol block'una kadar V1 payer → EODHD payee yeni aUSD transferi **0**. RPC log sorguları en fazla **199 inclusive block**, en fazla üç paralel istek olarak parçalanır; gerçekten sorgulanan aralıklar raporda bulunur. Bu kontrol gelecekteki işlemlere ilişkin bir garanti değildir.

API3 imzası exact request'e ait kaynağı ve bütünlüğü doğrular. Upstream EODHD kaydının mutlak doğruluğu, gerçek broker sahipliği veya gerçek varlık backing'i kanıtlanmaz. Tarihsel dividend kaydında bağımsız `updatedAt` yoktur; envelope freshness olay tarihinin güncelliği gibi sunulmaz.
