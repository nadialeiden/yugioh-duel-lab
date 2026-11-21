# Third-party components and sources

The application source is distributed under GNU AGPL version 3 or later; see `LICENSE`. This is an unofficial personal-practice project, not affiliated with Konami.

| Component | Use | Source / license |
| --- | --- | --- |
| `ocgcore-wasm@0.1.7` | Browser wrapper and precompiled OCGCore engine | [Wrapper source and build instructions](https://github.com/n1xx1/ocgcore-wasm), MIT wrapper; embedded core is AGPL-3.0-or-later |
| EDOPro / YGOPro core | Rule and duel processing | [edo9300/ygopro-core](https://github.com/edo9300/ygopro-core), AGPL-3.0-or-later, prior MIT notices retained in `dist/vendor/OCGCORE-LICENSE.txt` |
| Project Ignis CardScripts | Lua card effects and summoning procedures | [ProjectIgnis/CardScripts](https://github.com/ProjectIgnis/CardScripts), AGPL; `dist/vendor/CARDSCRIPTS-COPYING.txt` |
| BabelCDB | Simulator card data | [ProjectIgnis/BabelCDB](https://github.com/ProjectIgnis/BabelCDB); underlying card text remains its owners' content |
| `fflate@0.8.3` | Decompress bundled scripts | [101arrowz/fflate](https://github.com/101arrowz/fflate), MIT, included notice |
| `peerjs@1.5.5` | Optional hosted WebRTC rooms | [peers/peerjs](https://github.com/peers/peerjs), MIT, included notice |
| `ws@8.21.0` | Local server WebSocket rooms | [websockets/ws](https://github.com/websockets/ws), MIT, included notice |
| Playwright | Development-only browser checks | [microsoft/playwright](https://github.com/microsoft/playwright), Apache-2.0 |
| Konami Neuron English (Asia) | AE release identities, restriction list, printing evidence | [Official database](https://www.db.yugioh-card.com/yugiohdb/?request_locale=ae), structured factual snapshots with source URLs |
| YGOPRODeck | ID metadata and remotely loaded card illustrations | [API documentation](https://ygoprodeck.com/api-guide/); illustrations remain their owners' content |
| Google Fonts | DM Sans and Manrope | Remotely loaded fonts under their respective open font licenses |

The pinned npm package and its lockfile integrity identify the wrapper binary. `prepare_assets.py` records upstream sources and snapshot timestamps. The wrapper repository includes the core submodule and Emscripten build scripts; retain these source references and the GPL/AGPL notices when redistributing or modifying the engine bundle. Upstream card scripts are included as Lua source inside `dist/data/scripts.zip`.

Most card names, card text, and illustrations are © Studio Dice/SHUEISHA, TV TOKYO, KONAMI and other applicable owners. No ownership of those assets is claimed. The project's software license does not grant new rights to third-party card artwork or trademarks.
