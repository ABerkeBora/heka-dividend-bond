# Dividend Bond V2 — bağımsız collector kanıtı

Seçili track yalnız API3. Başlangıç: **31 Ekim 2026 04.29 Europe/Berlin**. Resmî sayfa browser'da açıldı, gerçekten API3 tab'ı seçildi; tam bölüm ve genişletilen submission/judging/examples okundu, genel How to submit ayrıca okundu. Bitiş recheck: **31 Ekim 2026 04.45 Europe/Berlin**. Gerçek API3 sekmesi ve genişletilmiş submission/judging/examples ile genel How to submit yeniden okundu; maddi fark yok. `evidence/v2/rules-recheck.json`.

Kaynaklar: [API3 kuralları](https://hackathon.tum-blockchain.com/prizes#api3), [genel teslim](https://hackathon.tum-blockchain.com/prizes#how-to-submit), [official starter](https://github.com/api3dao/airnodehub-hackathon-starter), [contract guide](https://api3dao.github.io/airnodehub-hackathon/docs/from-api-to-contract), [EODHD metadata](https://airnode-eodhd.fly.dev/). API3 zorunlu teknik maddeleri V1 ile aynı; yeni deployed flow üzerinde ayrıca kanıtlanır.

| Zorunlu madde | V2 uygulaması | Kanıt | Durum |
| --- | --- | --- | --- |
| Essential authenticated Hub data | Aynı immutable proof/payout contract, ayrı V2 deployment | evidence/v2/deployment.json + collection.json; 0x020c8...0289ba | PASS |
| Expected signer/exact request/timing | Resmî API3 verifier ve aynı pinned EODHD recipe | evidence/v2/tamper-live.json ve tamper-before-claim.json | PASS |
| Signed değer meaningful on-chain payout | Collector kendi key'iyle beneficiary'ye claimFor | evidence/v2/acceptance.json: collector payer/from, 26e6 payout | PASS |
| Duplicate execution | Contract state + ayrı kalıcı V2 intent journal | acceptance.json: fresh restricted run/recover sonrası bakiye/nonce aynı | PASS |
| Edited/stale/wrong-request/wrong-signer | Yeni contract'ta actual proof-policy retleri | Active claimFor ve consumed proof-policy eth_call; 36 contract testi | PASS |
| Judge response submission | V2 API/UI read-only verifier ve belgeli script | evidence/v2/browser-walkthrough.json; /next raw verifier | PASS |
| Contract/network/source trust açıklaması | README + MORNING_HANDOFF_V2 | README_V2.md + MORNING_HANDOFF_V2.md + SECURITY_V2.md | PASS |
| Public repo/setup README | Aynı repo, v1-baseline tag ve codex/next branch | v1-baseline tag push edildi; codex/next source push ve clean checkout son teslimde doğrulanır | PENDING |
| Video≤150s + Devfolio açıklaması | Outline/draft hazırlanır, gerçek video/submission kullanıcı işi | Recording/submission açık kalır | PENDING |

Kullanıcının ek kabul şartları: issuer setup ile collector runtime süreçleri ve key erişimi ayrılır; V1 `/` ve bütün geçmişi korunur; V2 `/next`, ayrı API/state/intent/deployment/asset/evidence. Collector kendi aUSD ve gas'ıyla gerçek ödeme/claim yapar; claim penceresinde issuer nonce'u değişmez. API caps uygulama seviyesinde, L2 gas bound ve L1 fee tahmini dürüstçe belirtilir. Yeni source/chain/LLM authority eklenmez.

Genel kural aynı: takım başına tek Devfolio başvurusu, en fazla üç partner track; deadline **31 Ekim 2026 15.00 Europe/Berlin**. Teknik kanıtların PASS olması video/submission'ın tamamlandığı anlamına gelmez. Jüri tercihleri (gerçek ihtiyaç, execution/originality, repeated autonomous cycles) zorunlu örnek fikirlerden ayrıdır; yeni ticker kataloğu veya runtime LLM gerektirmez.


Ek kullanıcı kabul kanıtları: **PASS** — ayrı issuer setup/collector process; issuer secret read ERR_ACCESS_DENIED, yalnız collector key; issuer nonce 15→15, collector 0→1; ödeme authorization ve exact Transfer/claim sender eşleşir. `collection-runtime.json`, `acceptance.json`, `independence.json`. V1 regression **PASS**,32 baseline evidence byte hash ve eski chain state/receipts korunur. 71 server +36 contract testi, build ve3width CUA QA PASS. API budget ve Node permission/L1 sınırları README_V2 ve security belgelerinde açık. Video ve Devfolio PENDING olarak kalır.
