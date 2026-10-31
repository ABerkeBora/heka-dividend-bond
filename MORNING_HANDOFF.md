# Dividend Bond — sabah incelemesi

31 Ekim 2026, Europe/Berlin. Ürün ve gerçek testnet tahsilatı çalışıyor. Yarışma videosu kaydedilmedi ve Devfolio başvurusu yapılmadı; teknik çalışma ile submission tamamlanması ayrıdır.

## Açılış

- Yerel uygulama: [http://localhost:3103](http://localhost:3103). Kendi production server'ı açık bırakılır.
- Repo: [ABerkeBora/heka-dividend-bond](https://github.com/ABerkeBora/heka-dividend-bond).
- Yeniden başlatma: `npm ci`, `npm run build`, `npm start`. Read-only inceleme için private key veya Foundry gerekmez; derlenmiş artifact'lar repoda. Contract geliştirme/testi için Foundry gerekir.
- Yeni örnek: mevcut kayıt Claimed/Void olduktan sonra `npm run fresh -- bond-morning`, ardından arayüzde **Authorize collection**. Bu komut yeni test tokenı ve fonlanmış contract açar; eski zincir geçmişi/evidence arşivlenir. Test wallet ve .env gerekir. Aktif rezerv gizlenmez.

## Gerçek çalışan akış

Seçili senaryo **bond-02**. Issuer 50 tdUSD kilitledi. Tek başlangıç mandate'i sonrası agent EODHD'ye **0,005 aUSD** ödedi, exact signed event'i doğruladı ve beneficiary'ye **26 tdUSD** tahsil etti. Kalan **24 tdUSD issuer'a** döndü; bu müşteri payout'u değildir. Contract bakiyesi sıfır, Claimed state ve beneficiary 26e6 atom ile receipt mutabık.

| Kanıt | Adres/işlem |
| --- | --- |
| Ağ | Base Sepolia, chain ID 84532 |
| DividendBond | [0x4b6a7feb8f0e9bb1ba51ad7921f352e0a4ee6e5b](https://sepolia.basescan.org/address/0x4b6a7feb8f0e9bb1ba51ad7921f352e0a4ee6e5b) |
| Rezerv fonlama | [50 tdUSD](https://sepolia.basescan.org/tx/0x377c4ad760b40272256d9e3ecab1e33d2ccf61d790a26dcdadb1dc13796df483) |
| Customer data fee | [0,005 aUSD](https://sepolia.basescan.org/tx/0x0baa356f7a5ed239fdd6dc220c191f28f2c501111d362d5168c328c248e1bc14) |
| Agent claim / payout | [26 tdUSD confirmed](https://sepolia.basescan.org/tx/0xf4419dba4bdd1f320074257d4f618bf7120136ab563c251c417b4218edc7acd3) |

`evidence/collection.json` mandate, response, işlem ve receipt'i tutar. İki teknik veri çağrısı ayrıca muhasebeleştirilir: projected preflight ve ham event-cardinality discovery, her biri 0,005 aUSD. bond-02'nin açılmasından önce aynı ham query'nin **tek event** döndürdüğü kanıtlandı. İlk entegrasyon bond-01 ve kendi işlemleri `evidence/scenarios/bond-01/` içinde korunur.

## Doğrulamalar

- **64 server testi PASS**: caps, yanlış asset/network/payee, expiry, unknown intent, crash rezervasyonu, cross-process locks ve receipt/raw-response recovery.
- **36 contract testi PASS**, ayrıca 256 fuzz koşusu: fixed-point/cap/reserve, permissionless payout, expiry, null/missing veri, dört tamper ve double claim. Gerçek EODHD fixture'ları ile sentetik local-signer testleri ayrı etiketli.
- TypeScript, production build ve dependency audit PASS; audit 0 açık.
- Canlı dört tamper reddi: `tamper-before-claim.json` aktif `claimFor` üzerinde **read-only eth_call**; `tamper-live.json` tüketim sonrası ortak proof verifier üzerinde. Timestamp oynanmadan gerçek stale proof kullanıldı. Revert transaction yayınlanmadı, dolayısıyla bu testler revert gas ödeme kanıtı diye sunulmaz.
- `npm run acceptance` PASS: over-budget ve yanlış recipient broadcast öncesi reddedildi; aynı process ve yeni process retry sonrasında aUSD/nonce/payment intent/beneficiary bakiyesi aynı. İkinci ücret veya payout yok.
- Gerçek CUA browser: 1440×900, 768×1024, 390×844. Authorization → pending → confirmed; telefon mandate erişimi; valid proof, malformed JSON, edited proof reddi ve valid response'a dönüş kontrol edildi. Yatay taşma yok. `evidence/browser-layout.json` ve `evidence/screenshots/final-*.jpg`.
- Public source push ve temiz checkout çalıştırma doğrulaması teslimin son adımında `evidence/delivery.json` içine kaydedilir.

## Sınırlar ve güven

Tarihsel AAPL.US ex-date 11 Ağustos 2025, ödeme 14 Ağustos 2025, unadjusted dividend 0,26 USD. Gerçek broker hisse sahipliği veya backing ispatı yok; test quantity anlaşmada sabit. İmza exact isteğin kaynağını/bütünlüğünü doğrular, EODHD'nin dünyadaki olguyu doğru aktardığını mutlak ispatlamaz. Ayrı upstream updatedAt alanı yoktur; taze envelope eski olayın revize edilemezliğini kanıtlamaz.

Mandate/API spending guard'ları **uygulama seviyesinde**, izole test wallet güveni var; on-chain session allowance değil. On-chain contract, signer/request/time/event/cap/immutable beneficiary ve tek payout'u enforce eder. Claim gas toplamı 1.690.194.002.005 wei; setup gas hariç. L2 transaction cost bound uygulanır, ek L1 ücreti marjlı tahmindir ve mutlak cap olarak sunulmaz. Bu prototip deterministik bounded agent kullanır; runtime LLM iddiası yoktur.

Paid API ücreti veya broadcast revert gas'ı sonraki proof hatasında geri alınmaz. Unknown settlement yeni authorization doğurmaz; `npm run recover` yalnız local owner PID'nin öldüğü kanıtlanan lock'ları açıp aynı intent'i uzlaştırır. Kaybolan cevap kurtarılamıyorsa yeni ücret yerine açık reconciliation gerekir.

## Sabah kalan işler — qualification etkisi

1. **PENDING: video kaydı**, 10–15 dakika. `PRESENTATION.md` 150 saniyelik outline; gerçek payout ve dört tamper reddi gösterilmeli. Eski kayıtlı response artık stale olacaktır; yeni akış için fresh örnek açılabilir. Outline video şartını karşılamaz.
2. **PENDING: Devfolio açıklaması ve gönderimi**, 5–10 dakika. `SUBMISSION_DRAFT.md` hazır. Resmî genel kurala göre takım başına **tek** başvuru, en fazla üç partner track. Hangi ürünün gönderileceğine kullanıcı karar vermeli; başvuru yapılmadı.
3. **İsteğe bağlı: yeni canlı walkthrough**, 2–4 dakika. Yeni mandate ve test fee gerektirir; aynı bond'u retry etmek tekrar veri almaz veya ödeme yapmaz. Dört tamper için script ücretsiz/read-only'dir.

API3 ve genel kurallar bitişte **03.56 Europe/Berlin** yeniden okundu. Son tarih **31 Ekim 2026 15.00 Europe/Berlin**. Zorunlu teknik maddeler kanıtlı; video ve Devfolio teslimi açık olduğundan “yarışmanın tüm şartları tamamlandı” denmez. Hosting veya competition submission yapılmadı.
