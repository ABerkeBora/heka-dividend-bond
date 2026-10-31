# Dividend Bond sonraki Goal

Durum: **ACTIVE**. 31 Ekim 2026 04.28 Europe/Berlin ilk `get_goal` gerçek sonucu `null`; aktif hedef yoktu. Önceki hedefin gerçek completion kaydı ve çalışan commit `BASELINE_V1.md` ile sabitlendi. `v1-baseline` tag'i `3a177521c49a32b07ccbc1be3985df8a86eab0c8` üzerine oluşturulup push edildi. `codex/next` açıldı. `create_goal` ardından `get_goal` gerçek sonucu **active**; thread/goal bağlantısı `01a18fd2-5d82-7c02-92a7-e4549e3f69df`, createdAt `1793417330`.

Objective: Issuer yalnız rezervi önceden fonladıktan sonra, issuer/deployer anahtarına erişmeyen beneficiary/collector'ın kendi sınırlı test aUSD ve gas bütçesiyle exact EODHD verisini satın alıp `claimFor` göndererek sabit beneficiary'ye gerçek testnet tahsilatı yaptığı bağımsız V2 akışını kanıtlamak.

Gerçek `get_goal` objective'i: Issuer yalnız rezervi önceden fonladıktan sonra, issuer/deployer anahtarına erişmeyen beneficiary/collector'ın kendi sınırlı test aUSD ve gas bütçesiyle exact EODHD verisini satın alıp claimFor göndererek sabit beneficiary'ye gerçek testnet tahsilatı yaptığı bağımsız Dividend Bond V2 akışını kanıtla. V1 / akışını v1-baseline tag/commit/kanıtlarıyla koru; codex/next üzerinde /next, ayrı API/intent/storage/deployment ve issuer setup/collector runtime süreçlerini uygula; gerçek kabul/ret, duplicate/restart, dört API3 tamper, V1 regression, build ve gerçek browser QA tamamla; README ve MORNING_HANDOFF_V2 ile aynı public repoya branch/tag publish et.

V1 `/` korunur. V2 `/next`, ayrı API/intent/storage/evidence, ayrı funded agreement ve ayrı collector runtime süreci. API3 kuralları koddan önce ve bitişte yeniden kontrol edilecek. Mainnet, hosting, competition submission ve genel agent platformu kapsam dışı.

Başlangıç rule gate: 31 Ekim 2026 **04.29 Europe/Berlin**, gerçek browser'da API3 sekmesi ve About/qualification/submission/judging/examples açılıp okundu; genel How to submit ayrıca okundu. V1 ile maddi fark görülmedi. Kaynaklar `TRACK_REQUIREMENTS_V2.md` içinde eşleştirilir. İlk teknik eşik: collector-only wallet dosyası ve issuer secret'ını okuyamayan ayrı Node permission process; sonra yeni funded contract üzerinden gerçek data payment+claim.

31 Ekim 2026 04.46 Europe/Berlin ara doğrulama: `get_goal` hâlâ **active**. Gerçek V2 ödeme/claim,14 kabul kontrolü,4 tamper,32 V1 evidence regression,71 server+36 contract testleri ve3width CUA QA PASS. Issuer nonce15→15,collector0→1. Kalan teslim adımı: codex/next push, temiz public checkout ve kısa REVIEW_SUMMARY.json; tamamlanmadan goal complete yapılmaz. Bitiş kuralları04.45'te yeniden okundu.
