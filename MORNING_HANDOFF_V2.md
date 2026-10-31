# Dividend Bond V2 — sabah incelemesi

31 Ekim 2026, Europe/Berlin. Bağımsız collector ile yeni gerçek testnet tahsilatı tamamlandı. İki akış aynı uygulamada erişilebilir:

- **V1:** [http://localhost:3103/](http://localhost:3103/) — baseline `v1-baseline`, commit `3a177521c49a32b07ccbc1be3985df8a86eab0c8`.
- **V2:** [http://localhost:3103/next](http://localhost:3103/next) — aynı public repo, `codex/next` branch'i.
- [V2 kaynak ve kurulum](https://github.com/ABerkeBora/heka-dividend-bond/tree/codex/next), [V1 tag](https://github.com/ABerkeBora/heka-dividend-bond/tree/v1-baseline). Yerel production server port 3103'te açık bırakılır.

## Kısa karşılaştırma ve öneri

**V2 önerilir.** V1'de veri ücreti ve claim executor'ı issuer/deployer'dı. V2 aynı finansal statement ve proof koşullarını koruyarak ayrı collector'ın kendi aUSD/gas'ıyla borcu tahsil ettiğini kanıtlıyor. Issuer'ın sonradan işbirliğine gerek kalmadığı vaadi, farklı payer/sender ve değişmeyen issuer nonce'u ile jüriye daha açık.

V1 çalışıyor ve eski 32 public evidence dosyası baseline ile aynı. V2 ayrı API, intent, storage, contract ve token kullanıyor; V1 receipt/escrow tüketilmedi. Her iki sürümde 26 tdUSD test payout var; **V2'ninki ayrı ve yeni transaction**. Harici müşteri pilotu yapılmadı.

**Sunum riski: medium.** Mevcut tamamlanmış tahsilat ve no-charge reconciliation doğrudan gösterilebilir. Taze envelope 300 saniye geçerlidir; kayıtlı proof sabah stale reddi verir. V2 setup şu an tek named senaryo için idempotent; yeni canlı payout için yeni isolated agreement/mandate gerekir. V1'in ayrı fresh helper'ı vardır. V2'yi yalnız yeni olduğu için değil, bağımsızlık kanıtı nedeniyle öneriyoruz.

## Ne değişti, ne kanıtlandı?

Issuer ayrı setup sürecinde 50 tdUSD rezervi fonladı; collector'a başlangıçta 50.000 aUSD atom ayırdı. Collector mevcut 0,001 test ETH gas'ını kullandı. Sonra issuer süreci bitti. Ayrı native Node24 permission process yalnız collector key dosyasını okuyabildi; issuer wallet, parent `.env`, V1 journal/evidence okumaları gerçek `ERR_ACCESS_DENIED` verdi. İlk ekonomik runtime kanıtı `evidence/v2/collection-runtime.json` içinde sabit.

Tek başlangıç mandate'i sonrasında collector EODHD'ye **5.000 aUSD atom** ödedi, exact request/signer/date/freshness kontrolünden geçen cevabı kullanarak `claimFor` gönderdi ve sabit beneficiary'ye **26.000.000 tdUSD atom** tahsil etti. Kalan 24 tdUSD issuer'a döndü. Veri ödemesi ve claim boyunca issuer nonce **15 → 15**, collector EOA nonce **0 → 1**. EIP-3009 ödeme nonce'u ayrıca tüketildi; x402 transferinin settlement gas'ını facilitator ödedi.

| Kanıt | Gerçek referans |
| --- | --- |
| Ağ / contract | Base Sepolia 84532 / [0x020c8bc7c9d4e3fdde1af6d9ad31a284850289ba](https://sepolia.basescan.org/address/0x020c8bc7c9d4e3fdde1af6d9ad31a284850289ba) |
| Ayrı collateral | [0xc61371f8c5508cbd9862b76173eac5e6ef479478](https://sepolia.basescan.org/address/0xc61371f8c5508cbd9862b76173eac5e6ef479478) |
| Issuer rezerv fonlama | [50 tdUSD](https://sepolia.basescan.org/tx/0xf73c3815cfe411207d72067379fe878a82f5db5c984d69844550db6d5e367004) |
| İlk collector bütçesi | [0,05 aUSD allocation](https://sepolia.basescan.org/tx/0x112592c42f5658ee4d92ec1ccbe15c8aaecbbc035e88e475e29ba20a9d695380) |
| Collector data purchase | [0,005 aUSD](https://sepolia.basescan.org/tx/0x84a9bd85caec8f0d30974545c56c4633ec1ffe80deef8e34f8928829dabce7b3) |
| Collector claim / beneficiary payout | [26 tdUSD confirmed](https://sepolia.basescan.org/tx/0x9dc93dca56d5c3b5418d9d31f6bc613abebc487897f3a2ce49419c296c6ca4d4) |

`evidence/v2/acceptance.json`: 14 kontrol PASS; authorization payer/value/payee/nonce, exact confirmed aUSD Transfer, gerçek claim `from`/target/nonce, beneficiary event/balance, issuer nonce ve key sınırı birbirine bağlanır. Over-budget, wrong-recipient ve expired mandate gerçek pre-signing guard'da reddedildi; imza/broadcast yok. Ayrı restricted process retry ve recovery sonrası aUSD/gas/nonce/payout aynı, ikinci ücret yok.

## Çalıştırma ve doğrulama

Node **24** kullanın. `npm ci`, `npm run build`, `npm start`; iki URL aynı server'dadır. Key olmadan tamamlanmış kayıt/receipt incelenebilir; recorded ekonomik runtime kanıtı ile şu anki read-only viewer ayrı etiketlenir. State/verify public evidence'i değiştirmez. Ayrıntılar `README_V2.md` ve `SECURITY_V2.md`.

- `npm run check`, **71 server testi** (64 V1 + 7 V2), **36 contract testi** + 256 fuzz, production build PASS. Dependency audit: 0 açık.
- `evidence/v2/tamper-before-claim.json`: yeni Active contract üzerinde edited/stale/wrong-request/wrong-signer reddi, rezerv/state aynı.
- `evidence/v2/tamper-live.json`: collection proof zamanında valid PASS ve dört ret PASS. Bunlar deployed contract'a **read-only eth_call**; başarılı payout ayrı broadcast transaction.
- `evidence/v2/v1-regression.json`: 32 V1 public evidence hash'i aynı, eski claimed/payout/rezerv/receipt'ler aynı, yeni V1 data fee yok. RPC logları 199 block'luk aralıklarla okunur.
- CUA browser 1440/768/390: V2 authorization, pending, confirmed, valid/edited proof ve toparlanma; iki route farklı gerçek receipt gösteriyor. Yatay taşma veya 11px altı görünür metin yok. `evidence/v2/screenshots/` ve browser raporları.
- `npm run v2:collect` mevcut claim'i tekrar ücretlendirmez. `npm run v2:recover` yalnız ölü local process lock'larını kaldırıp aynı mandate'i uzlaştırır; yeni mandate açmaz. `v2:setup` mevcut named setup işlemlerini yeniden fonlamadan uzlaştırır.

## Güven sınırları ve açık işler

API caps uygulama seviyesinde ve izole collector wallet ile sınırlı; on-chain session allowance yok. Contract signer/request/timing/event/cap/beneficiary ve tek payout'u enforce eder. L2 transaction cost bounded; Base L1 fee marjlı tahmindir. Node permission modeli trusted-code dosya erişimi için korumadır; aynı OS kullanıcısının kötü niyetli koduna karşı mutlak sandbox değildir.

Aynı EODHD historical recipe kullanılır: AAPL.US ex-date 11 Ağustos 2025, unadjusted dividend 0,26 USD, ödeme 14 Ağustos. Kurulumdaki public ham-event discovery yalnız terms/cardinality kaynağıdır; V1 ödeme receipt'i V2 satın alma kanıtı diye kullanılmadı. Yeni V2 exact request gerçekten collector tarafından satın alındı. İmza broker ownership/backing veya upstream doğruluğu ispatı değildir.

**PENDING:** 150 saniyelik video kaydı (10–15 dk) ve kullanıcının Devfolio gönderimi (5–10 dk). `PRESENTATION_V2.md` kayıt akışı, `SUBMISSION_DRAFT.md` önceki temel metin ve bu handoff yeni farkları verir. API3/general rules **04.45 Europe/Berlin** yeniden okundu; maddi değişiklik yok. Deadline 31 Ekim 2026 **15.00 Europe/Berlin**, takım başına tek submission. Hosting/mainnet harcaması/yarışma gönderimi yapılmadı.
