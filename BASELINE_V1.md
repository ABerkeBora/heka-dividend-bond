# Dividend Bond V1 baseline

V1 hedefi önceki çalışmada gerçekten `complete` oldu. Yeni iş başlangıcında `get_goal` sonucu `null` döndü: şu anda aktif goal yok; önceki completion ve teslim kanıtları `BUILD_STATUS.md` ve `evidence/delivery.json` içinde korunuyor. Kontrol: 31 Ekim 2026 04.28 Europe/Berlin.

- Çalışan commit: `3a177521c49a32b07ccbc1be3985df8a86eab0c8`.
- Kayıpsız tag: `v1-baseline`, bu commit'e bağlanır; mevcut tag hareket ettirilmez.
- V1 URL: [http://localhost:3103/](http://localhost:3103/).
- Çalıştırma: `npm ci && npm run build && npm start`; private key olmadan saved receipt ve chain state incelenir.
- V1 contract: Base Sepolia `0x4b6a7feb8f0e9bb1ba51ad7921f352e0a4ee6e5b`.
- V1 collateral: `0x1c94037d2c84879ae78e66d29a9d5e03856440ae`; yalnız V1'e ait.
- V1 claim: `0xf4419dba4bdd1f320074257d4f618bf7120136ab563c251c417b4218edc7acd3`, 26 tdUSD beneficiary payout.
- V1 API payment: `0x0baa356f7a5ed239fdd6dc220c191f28f2c501111d362d5168c328c248e1bc14`, 5000 aUSD atom.
- Public kanıtlar: `evidence/deployment.json`, `collection.json`, `acceptance.json`, `tamper-before-claim.json`, `tamper-live.json`, `verification.json`, `clean-checkout.json`, `screenshots/final-*.jpg`; ayrıca önceki bond-01 `evidence/scenarios/` altında.
- Private state: `.local/journal.json`, `.local/mandates/`, `.local/payments/`, `.local/transactions/`, `.local/deploy-bond-02.json`. Bunlar V2 tarafından tüketilmez veya resetlenmez.
- V1 state Claimed, reserve sıfır. V1'e yeni ekonomik işlem gerekmez. V2 ayrı deployment/token/evidence/intent/runtime namespace'ine sahip olacak.

V1 doğrulaması: 64 server, 36 contract testi ve 256 fuzz koşusu; production build ve 1440/768/390 CUA QA; public clean checkout ve no-key receipt reconciliation PASS. Yarışma videosu/Devfolio gönderimi V1 tesliminde de açıkça PENDING idi; V2 bu kayıtları değiştirmez.
