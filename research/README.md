# Asian-English format snapshots

These data files were checked against Konami Neuron's **English (Asia)** locale on 22 November 2026. They are factual research inputs for the app, not a claim of Konami approval.

- `ae-rules.json`: effective **1 October 2026**. The official list contains 34 Forbidden, 41 Limited, and 14 Semi-Limited cards. Match restrictions by `konami_id_limits` where possible because AE and TCG card names can differ. `limits` is the human-readable name mapping. A card absent from this restriction list is normally allowed at up to three copies; release eligibility is checked separately.
- `ae-pool.json`: the complete official English (Asia) Card Search result identities, traversing every page at 100 cards per page. Contains `cids` plus `cards` (name / Konami ID) and a checked date. Official search results include Forbidden cards; this pool is a release-availability filter, not the Forbidden & Limited List.
- `starter-card-evidence.json`: all 55 unique cards from the AE Exosister Tactical-Try and Swordsoul Duel-Ignition products, mapped to simulator passcodes with individual official AE printing codes and release dates. `released: true` requires an AE-numbered printing released on or before the checked date.
- `starters.json`: two **curated practice lists**, each with 40 Main and 15 Extra cards, built exclusively from the above evidence. These are neither tournament-winning lists nor exact sealed-product deck recipes.
- `additional-recipes.json`: Rescue-ACE, Salamangreat, Blue-Eyes, and Labrynth practice recipes by exact simulator name and quantity. The bundler maps these to verified AE identities and refuses missing releases, wrong sections, or combined copy-limit violations before including them in the app.
- `refresh_ae_data.py`: refreshes the official restriction list and card pool, validates locale/pagination/completeness, then rebuilds the curated starters. The script retains an old pool file if the new pool fails its checks. It refuses to publish an incomplete or future restriction list.

## Refresh

Requires Python with `requests` and `beautifulsoup4` installed:

```powershell
python research/refresh_ae_data.py
```

Use `--as-of YYYY-MM-DD` for a reproducible checked date, or `--skip-pool` to regenerate restrictions and starters without fetching all pool pages. If Konami changes the restrictions so that a starter becomes invalid, the script raises an error so the recipe can be revised instead of silently changing quantities.

The script refreshes rules and release identities, not card-effect implementations. OCG core, card database, and Lua scripts must be updated separately. An identity present in the AE pool must still pass the simulator database's released-OCG and non-prerelease filters. Main/Extra/Side copy limits are combined.

## Official references

- [AE Forbidden & Limited List](https://www.db.yugioh-card.com/yugiohdb/forbidden_limited.action?request_locale=ae)
- [Konami Asia AE list](https://www.yugioh-card.com/asia/play/forbidden-and-limited-card-list-ae/)
- [Official AE Card Search](https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&request_locale=ae&rp=100&stype=1&keyword=)
- [AE Tactical-Try Deck Exosister contents](https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&pid=5000001474000&rp=99999&request_locale=ae)
- [AE Duel-Ignition Swordsoul contents](https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&pid=5000001419000&rp=99999&request_locale=ae)

Konami states on Neuron's home page that card information becomes available starting from its release date. As a spot check, AE search currently returns Exosister Karmael and does not return Sky Striker Ace - Camellia. Older AE releases are part of the official search pool.

Research corrections: Ash Blossom & Joyous Spring is **Semi-Limited (2)** in the official October list; some secondary articles state three. Maxx "C" and Dimension Shifter are each **Limited (1)**. The included Exosister and Swordsoul recipes respect these limits.
