# Dividend Bond — güvenlik incelemesi

31 Ekim 2026. Bu belge bağımsız bir profesyonel audit iddiası değildir; uygulama kapsamındaki güven sınırlarını ve çalıştırılan kontrolleri kaydeder.

## Korunan para ve yetki

- `DividendBond` issuer rezervini tam payout cap kadar `fund()` ile ayırır. Sonradan term, signer, request, quantity, beneficiary veya ödeme tarihi değiştirme fonksiyonu yoktur.
- `claimFor` permissionless'tır; caller alıcı veya ödeme miktarı veremez. Ödeme miktarı imzalı `declaredDividend` ile sabit quantity'den integer `mulDiv` kullanılarak üretilir, cap uygulanır. Claim öncesinde expected signer, exact request, envelope freshness, event/payment/record dates ve USD kontrol edilir.
- Başarılı claim state'i transferden önce tüketir ve reentrancy guard kullanır. Kullanılmayan rezerv issuer'a döner. Rejected proof veya duplicate claim korunan collateral/payout durumunu değiştirmez.
- `voidExpired` yalnız önceden sabitlenen claim deadline + grace sonrasında kullanılabilir. API hatası veya eksik veri tek başına borcu yok saymaz.
- EODHD/Airnode imzası kaynağı ve exact byte bütünlüğünü kanıtlar; gerçek broker sahipliği, rezerv backing'i veya upstream olayın mutlak doğruluğunu kanıtlamaz. Kaynak ayrıca upstream update timestamp sağlamaz; tarihsel event tarihi ile envelope zamanı farklıdır.

## Veri satın alma guard'ı

`server/payment.ts` yalnız sabit EODHD URL'sine, sabit request'e gider. Redirect kapalıdır. x402 challenge exact scheme, Base Sepolia chain, aUSD asset, pinned payee, integer fiyat, per-call/total cap, action sayısı, expiry, token domain ve authorization timeout sınırlarından geçer. Signed authorization ayrıca from/to/value/validBefore bakımından kontrol edilir. Beklenmeyen payment flow kabul edilmez.

RPC chain ID kontrolünden sonra imza üretilir. Başarı için settlement network/payer ve confirmed receipt'te tam asset/from/to/value `Transfer` event'i gerekir; provider'ın yalnız HTTP 200 dönmesi başarı sayılmaz. Ham response byte'ları resmî starter verifier'ına verilir; request/signer response'un kendi beyanından seçilmez.

Mandate spend guard'ları uygulama kodunda uygulanır. Payout alıcısı, proof koşulları ve tek claim kuralı contract'tadır. Bu ürün genel bir account-abstraction/session-key platformu veya on-chain API harcama limiti iddiasında bulunmaz. Backend'deki test wallet key dosyası, bu uygulamanın tek başına güvenli bir production custody çözümü olduğu anlamına gelmez.

## Idempotency ve kesinti

- `withLock('workflow', ...)` agent workflow'unu; `withLock('data-payments', ...)` veri ödemelerini process'ler arasında atomik directory ile serileştirir. Aynı anda ikinci worker imza üretemez.
- Bir x402 authorization, paid request gönderilmeden önce ignored `0600` ödeme journal'ına yazılır. Her signed authorization'ın tam bedeli rezerve sayılır; unknown/rejected outcome bu bedeli sessizce serbest bırakmaz.
- Toplam reservation/action sayısı ödeme kayıtlarından türetilir. Payment kaydı ile convenience mandate kaydı arasındaki crash bütçeyi azaltmış gibi gösteremez.
- Var olan unknown intent için yeni authorization üretilmez. Reconciliation token nonce/receipt'i okuyabilir; kayıp provider yanıtını veya support edilmeyen cache davranışını uydurmaz. Tahsil edilemeyen yanıt için otomatik ikinci ücret yoktur.
- Eğer provider'ın ham cevabı ve settlement hash'i kesintiden önce kaydedilmişse, reconciliation confirmed receipt'teki exact transferi ve kaydedilen response'un imza/request'ini tekrar doğrulayarak kaydı `CONFIRMED` yapabilir. Yanıtın tazeliği daha sonra consuming contract'ta ayrıca kontrol edilir; eski proof yeni ödeme olmadan taze olmuş sayılmaz.
- Interrupted process'in lock'ı otomatik kırılmaz. `npm run recover` yalnız aynı makinede PID'nin kesin sona erdiği (`ESRCH`) bilinen workflow/data-payment lock'larını kaldırır; canlı, yabancı makineye ait veya owner'ı bilinmeyen lock'ta durur. Ardından var olan mandate'in aynı intent'ini uzlaştırır; yeni mandate veya unknown payment için yeni authorization oluşturmaz. Owner yazılmadan yaşanan crash manuel inceleme gerektirir.
- EIP-3009 authorization ve signature hiçbir public API/evidence çıktısına konulmaz. `paymentSummary()` yalnız seçilmiş public receipt/attestation alanlarını döndürür.

## Doğrulama

`npm test`: fiyat/cap/expiry, wrong recipient/asset/network/scheme/domain, malformed mandate, maximum actions, kalıcı unknown intent, crash reservation ve filesystem lock davranışı için executable testler. Cross-process testi ayrıca ayrı Node process'iyle tutulan lock'a girmeyi dener. Testler key dosyası okumaz, ağ veya ödeme çağrısı yapmaz. `forge test` contract policy, rounding, reserve, replay ve proof rejection kapsamını ayrıca doğrular; canlı chain kanıtları `evidence/` içinde tutulur.

Base/OP transaction gas maliyetinde L2 execution ücreti ve L1 data ücreti ayrıdır. EIP-1559 gas limit/maxFee yalnız L2 kısmını sert sınırlar; L1 data fee tahmini mutlak zincir-üstü cap değildir. Son gas bütçesi iddiası agent/transaction uygulaması ve gerçek receipt'teki L1 + L2 maliyetleriyle birlikte okunmalıdır. Harcanmış API fee veya broadcast edilmiş reverted transaction gas'ı geri alınmış sayılmaz.

## Raw event keşif kapısı

CLI-only `discover-event.ts`, yalnız sabit `dividendHistory` + AAPL.US + 2025-08-11 aralığını projeksiyonsuz çağırabilir. Bu technical recipe'nin request hash'i ayrı ve product request'i değiştirmez. En fazla tek ödeme ve 10.000 aUSD atom toplam/per-call cap vardır. Aynı journal/lock, receipt ve signer guard'ları kullanılır. `evidence/event-discovery.json` imzalı raw array'de tam bir eşleşen kayıt olduğunu gösterir. Bu, ilerideki provider revizyonlarını engelleyen bir garanti değildir; yeni fonlama öncesindeki gözlenmiş belirsizliği reddetme kapısıdır.
