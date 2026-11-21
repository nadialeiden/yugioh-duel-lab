# AE Duel Lab

A browser-based Yu-Gi-Oh! practice table for the **Asian-English OCG format**. Built for personal practice, with an Exosister starter and support for other decks.

## Run locally

Install **Node.js 22 or later**, then:

```powershell
git clone https://github.com/nadialeiden/yugioh-duel-lab.git
cd yugioh-duel-lab
npm ci
npm start
```

Open **http://localhost:4173**. The terminal also prints your machine's LAN address. The prepared card data, scripts, and browser engine are included in the repository; Python is only needed when refreshing that data.

## Modes

- **Practice:** play against an AI opponent. Choose one of the six included presets or any legal saved deck for either side. Choose turn order and optional helpers. Review measured decisions, response opportunities, resources, and sequencing prompts.
- **Local duel:** two devices, two browsers, one room. On the local Node server, both devices open the **same printed LAN URL**, then one creates a room and the other enters its six-character code. Both decks are validated. The host goes first. Rooms expire when either player disconnects.
- **Deck workshop:** search the verified AE pool, edit Main/Extra/Side, save multiple decks, import `.ydk`, `ydke://`, or names with quantities, and export `.ydk`. Optional event/source fields retain tournament-list provenance. An imported tournament list still has to pass AE validation.
- **Learn the interface:** a separate six-lesson tour. Try inspecting a card, making a demonstration summon, exploring the phase display, and stepping through a Pax / Ash Blossom / Called by the Grave chain. The tour never changes an active duel or your decks.

The included decks are curated practice lists, **not tournament-winning recipes**. Saved decks stay in the current browser's local storage; export `.ydk` to back them up or move them between devices.

During a duel, the table shows each chain link with its card, activating player, and resolution/negation status. Animation pauses AI progression so the response is readable; Skip advances the presentation, and Details reopens the last resolved chain. On a phone, use **Show table / Open decisions** to switch between the board and the fixed bottom decision drawer. Tapping your card opens its text and legal action buttons. Timing help can be expanded when needed.

Card and zone selections remain editable until **Confirm selection**. In a single-choice picker, tap another candidate to replace the pending choice. Tap a selected candidate to deselect it, or use **Clear selection** to start over.

| AI deck preset | Matchup focus |
| --- | --- |
| Exosister | Xyz control and graveyard response timing |
| Swordsoul Tenyi | Synchro summons and disruption sequencing |
| Rescue-ACE | FIRE control and back-row interaction |
| Salamangreat | FIRE Link summons and graveyard recursion |
| Blue-Eyes | Dragon Synchro/Fusion pressure and recovery |
| Labrynth | Normal Trap control and resource management |

## Format snapshot

The bundled Forbidden & Limited List is effective **1 October 2026**, verified **22 November 2026**. The release pool contains **7,068 official AE card identities** from Konami Neuron's English (Asia) search. Alternate artwork means multiple simulator passcodes can map to one identity.

Eligibility and restrictions are separate checks: a card needs a released OCG simulator entry, an AE identity in the official pool, correct Main/Extra placement, and a legal combined copy count across Main, Extra, and Side. Restrictions prefer Konami IDs because AE and international names can differ. The app does not substitute the Japanese OCG, TCG, or Master Duel banlist.

- [Official AE restriction list](https://www.yugioh-card.com/asia/play/forbidden-and-limited-card-list-ae/)
- [Official English (Asia) card database](https://www.db.yugioh-card.com/yugiohdb/?request_locale=ae)

This is a dated snapshot. It does **not** update itself when Konami releases a new set or list.

## Tests

```powershell
npm test
npm run test:engine
npm run test:ai
```

With `npm start` running, browser checks are available:

```powershell
npm run test:browser
npm run test:local
npm run test:chains
npm run test:local-chains
npm run test:mobile
```

The included Windows browser checks use installed Microsoft Edge. Set `BROWSER_PATH` to another Chromium executable if needed; on other platforms they can use Playwright Chromium after `npx playwright install chromium`. Browser tests save screenshots under ignored `qa/`.

## Refresh data

```powershell
python -m pip install -r requirements.txt
npm run refresh:data
npm run build
npm test
npm run test:engine
```

The refresh refuses incomplete AE pagination or future restriction lists. If new restrictions invalidate a curated starter, revise the recipe in the research helper; it will not silently change the deck's quantities. Refresh engine binaries separately by updating the pinned package, reviewing its API changes, and rebuilding vendor assets. Do not assume a new card-script snapshot is compatible with every old core version.

## Hosting

`vercel.json` is configured for a static deployment from `dist/`, with `npm run build` as its build command. The repository's Vercel connection can deploy a push to `main`; publishing status is separate from Git push success.

Practice, deck editing, and Learn run entirely in the browser. Hosted rooms use a PeerJS WebRTC connection with public signaling. That path needs internet access for signaling and a network that permits WebRTC; no TURN relay is configured, so direct connectivity across restrictive networks is not guaranteed. Same-Wi-Fi use is the intended hosted room scenario. The local Node/WebSocket path needs no external signaling and is the primary LAN path.

## Practical limits

- OCGCore and Project Ignis Lua scripts enforce card effects and legal actions. This fan project is not a Konami-certified simulator or ruling authority.
- The AI is a **heuristic practice opponent**, not WindBot or an optimal-play solver. It can play multiple decks through engine-provided actions, but its deck-specific planning is limited. Complex/unusual selections may need a manual decision for the AI, explicitly identified in the UI.
- Evaluations count choices and resources and offer conditional sequencing prompts. They do not grade a move as objectively optimal or calculate a win probability.
- The phone effect bundle is about 5 MiB and loads when a duel starts. Card illustrations and web fonts use external sources; the duel data and engine are bundled locally.
- Rooms have one host and one guest. There is no matchmaking, account system, ranked ladder, spectator mode, reconnect recovery, or best-of-three sideboarding flow.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for module boundaries, data preparation, room transport, rule enforcement, testing, and extension notes. See [THIRD_PARTY.md](THIRD_PARTY.md) and [LICENSE](LICENSE) for source and license information.
