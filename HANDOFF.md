# Dividend Bond — uygulanan kapsam

Tek önceden fonlanmış sentetik temettü yükümlülüğünü beneficiary adına tahsil eden yerel ürün. Yalnız API3; port 3103. Bu dosya uygulanmış kapsamı özetler; güncel çalıştırma komutları ve dış kanıtlar README.md, sabah durumu MORNING_HANDOFF.md içindedir.

## İş ve taraflar

Issuer, 100 test birimi için AAPL.US tarihsel temettüsünü ödemeyi üstlenir; 50 tdUSD rezervi önceden kilitler. Beneficiary buyer rolüdür; issuer/deployer'dan farklı adrestir. Agent'ın başlangıç mandate'i sonrasında EODHD ücretini payer/deployer aUSD ile öder ve issuer rezervinden beneficiary'ye 26 tdUSD tahsilatı gerçek transaction ile başlatır. Veri payee'si EODHD Airnode adresidir. Issuer'a dönen 24 tdUSD surplus müşteri payout'u değildir.

Gerçek hisse alımı/saklaması, dış broker sahipliği, backing veya menkul kıymet ürünü iddiası yoktur. aUSD veri ücreti ile tdUSD teminatı ayrıdır. Bütün varlıklar Base Sepolia test varlıklarıdır.

## Sabit reçete

EODHD dividendHistory; ticker AAPL.US; from/to 2025-08-11. Bu parametreler ex-dividend tarihini filtreler. Projection eventDate/recordDate/paymentDate/unadjustedValue/currency alanlarını sabitler. Exact request hash ve beklenen signer sözleşmede değişmezdir. İlan edilen tutar unadjustedValue 0.26 USD; adjusted value başka semantiktir.

Ham, ayrı imzalı discovery sorgusu tek kayıt döndüğünü doğruladı. bond-02 bu kanıt alındıktan sonra açıldı. bond-01 erken entegrasyon geçmişi arşivdedir. Discovery imzası daha sonra upstream revizyon olmayacağını ispatlamaz. Tarihsel kaydın ayrı update zamanı yoktur; icat edilmez. Envelope max-age 300s, future skew 60s; exact ex/payment dates, geçerli recordDate ve USD kontrol edilir. Eksik/null/uyumsuz veri payout'u durdurur.

## Yetki ve idempotency

Bir mandate: fixed network 84532/asset/payee/source/request/contract/beneficiary; per-call 10000 aUSD atom, toplam 50000 atom, en fazla 2 data purchase ve 1 claim; 1800s ömür. Claim gas bütçesi 200000000000000 wei; L2 transaction sınırı enforce edilir, L1 ek ücreti marjlı tahmindir. Setup gas kapsam dışıdır. Bu mandate/API limitleri uygulama guard'ıdır, on-chain session allowance değildir. Fonlar izole test wallet'ta sınırlıdır; otomatik top-up yoktur.

İmzalı x402 authorization paid request'ten önce ignored local journal'a yazılır. Confirmed receipt'te exact token Transfer kontrol edilir. UNKNOWN aynı intent için yeni imza doğurmaz; kayıtlı receipt/rawBody varsa sadece doğrulanarak kurtarılır. Cross-process lock eşzamanlı yürütmeyi engeller. Claim signed raw transaction ve hash broadcast'ten önce yazılır; yeniden denemede aynı hash uzlaştırılır. Claimed durumda veri satın alınmaz. Process restart ve duplicate sonrası yeni ücret/payout oluşmadığı canlı kabul kanıtındadır. Model key veya serbest calldata görmez; deterministik agent kullanılır.

## Contract ve süre

Reserve tamcap kadar fund edilir. Permissionless claimFor alıcı argümanı almaz; para değişmez beneficiary'ye gider. Miktar integer fixed-point mulDiv, aşağı yuvarlama ve cap ile belirlenir. Checks→state→safe transfer, reentrancy koruması; tekclaim. Başarıda unused cap issuer'a döner. 24 saat deadline+ 1 saat claimable grace sonrası claim edilmemiş rezerv permissionless void ile issuer'a döner. Bu hukuki temettü hakkının son kullanma iddiası değildir.

## Arayüz ve teslim

Sakin finansal statement, serif başlık/sans gövde, mürekkep vurgu. Ana görev Authorize collection; ledger Data purchase→Verification→Claim sent→Funds received. Kaynak incelemesi ve ham response verifier ikincil disclosure'dadır. Read-only proof check payout başlatmaz; gerçek agent yolu claim transaction'ıdır. Paid API ücreti veya broadcast revert gas'ı sonradan başarısız proof ile geri alınmaz.

Gerçek geçerli payout, dört tamper reddi, duplicate/expiry/rounding/reserve testleri, bütçe/recipient guard ve restart kanıtı gerekir. Test fixture'ları canlı qualification yerine geçmez. Kaynak lisansları korunur; public repo self-contained olur. Video için 150s outline ve submission taslağı teslim edilir; video kaydı/Devfolio gönderimi ayrı kalan iştir. Kullanıcı adına yarışma başvurusu veya hosting yapılmaz.
