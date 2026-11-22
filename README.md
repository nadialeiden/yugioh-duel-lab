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

- **Practice:** play against an AI opponent. Choose a preset or a legal saved deck for either side, then pick Beginner, Standard, or Expert. Beginner plays simpler lines with fewer interruptions. Standard uses the original bot. Expert uses card-specific priorities where available, holds disruption for stronger targets, manages resources and plans attacks. Practice Review includes the chosen difficulty in its export.
- **Local duel:** two devices, two browsers, one room. On the local Node server, both devices open the **same printed LAN URL**, then one creates a room and the other enters its six-character code. Both decks are validated. The host goes first. Rooms expire when either player disconnects.
- **Deck workshop:** search the verified AE pool, edit Main/Extra/Side, save multiple decks, import `.ydk`, `ydke://`, or names with quantities, and export `.ydk`. Optional event/source fields retain tournament-list provenance. An imported tournament list still has to pass AE validation.
- **Learn the interface:** a seven-lesson tour from setup through post-duel review. Read a card, choose and confirm a Monster Zone, hand the turn to your opponent, and step through a Pax / Ash Blossom / Called by the Grave chain. You can replay the examples without starting a duel.

The deck picker includes curated practice presets and a **Tournament decks** group. On a fresh profile, your deck defaults to the Mogi Cup Exosister build. You can inspect the event, placement, and source from **View deck cards**. The workshop saves a personal copy when you edit and save a tournament list. Saved decks stay in the current browser's local storage.

Enter through the sign-in screen using one of the three shared demo accounts. Each account gets its own saved decks. Click your name in the header to change your display name or sign out. Use the original login ID to sign back in. Account data is saved per browser and site address.

**Continue as guest** opens Practice and Learn with the built-in decks for 30 minutes. Each browser gets one pass per UTC day, and each IP address gets up to three. Use an account to save decks or open Local Duel.

During a duel, the table shows each chain link with its card, activating player, and resolution/negation status. Animation pauses AI progression so the response is readable; Skip advances the presentation, and Details reopens the last resolved chain. On a phone, use **Show table / Open decisions** to switch between the board and the fixed bottom decision drawer. Tapping your card opens its text and legal action buttons. Timing help can be expanded when needed.

Main Phase card actions stay pending until **Confirm play**. Card, zone, and material prompts use **Confirm selection**. In a single-choice picker, tap another candidate to replace the pending choice. Tap a selected candidate to deselect it, or use **Clear selection** to start over.

The heading, turn marker, and mobile drawer identify **Your turn / Opponent’s turn** from your perspective, including response windows during the other player's turn. Use **Read card** next to a candidate or chain response to inspect its full text without changing the pending choice or activating it. Pre-duel deck selectors also have **View deck cards** previews, with a Back to deck button after inspecting a card.

| AI deck preset | Matchup focus |
| --- | --- |
| Exosister | Xyz control and graveyard response timing |
| Swordsoul Tenyi | Synchro summons and disruption sequencing |
| Rescue-ACE | FIRE control and back-row interaction |
| Salamangreat | FIRE Link summons and graveyard recursion |
| Blue-Eyes | Dragon Synchro/Fusion pressure and recovery |
| Labrynth | Normal Trap control and resource management |

### Tournament presets

| Deck | Result |
| --- | --- |
| Exosister | Daikon, Top 4, Mogi Cup #25 (3v3, 27 September 2026). [Published list](https://ygo.iwantcard.tw/decks/30954) |
| RoLaD – Mitsurugi Light and Darkness Ritual | Melvin Sundoro, winner, Indonesia City Duel Bali AE (17 October 2026). [Published list](https://ygoprodeck.com/deck/mitsurugi-light-and-darkness-ritual-740214) |
| Branded Elfnote | Samuel Lorent, Top 4, Indonesia City Duel Bali AE (17 October 2026). [Published list](https://ygoprodeck.com/deck/branded-elfnote-740218) |
| Power Patron | Dimas Adhi Pratama, Top 4, Indonesia City Duel Bali AE (17 October 2026). [Published list](https://ygoprodeck.com/deck/power-patron-740217) |
| Branded Dracotail | GARAITO92, winner, Kuma Kuma Kadoya Ranking (4 October 2026). [Published list](https://ygoprodeck.com/deck/branded-dracotail-740212) |

Each list retains its Main, Extra, and Side Deck. All five pass the current AE checks. The Exosister list comes from a Japanese OCG team event and passes AE checks with the same cards and quantities.

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
npm run test:ai-benchmark
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

`npm run build -- --vercel` packages the static app, entry middleware, and login function for Vercel. The connected GitHub project deploys pushes to `main`. Set `DUEL_SESSION_SECRET` to a private random value to retain sessions across deployments and restarts. The three demo passwords can be set in `DUELIST1_PASSWORD`, `DUELIST2_PASSWORD`, and `DUELIST3_PASSWORD`.

Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` and `KV_REST_API_TOKEN`) to share guest counts across function instances and restarts. Without Redis, the LAN server tracks the daily IP quota in its process and Vercel tracks it per running function instance.

Practice, deck editing, and Learn run entirely in the browser. Hosted rooms use a PeerJS WebRTC connection with public signaling. That path needs internet access for signaling and a network that permits WebRTC; no TURN relay is configured, so direct connectivity across restrictive networks is not guaranteed. Same-Wi-Fi use is the intended hosted room scenario. The local Node/WebSocket path needs no external signaling and is the primary LAN path.

## Practical limits

- OCGCore and Project Ignis Lua scripts enforce card effects and legal actions. This fan project is not a Konami-certified simulator or ruling authority.
- Expert has dedicated strategy coverage for the curated practice presets. Tournament lists and custom decks use the available strategy rules for their cards and generic scoring for the rest. The benchmark measures performance against Standard in seeded, single-duel mirror matches. An unusual decision can still prompt manual assistance.
- Evaluations count choices and resources and offer conditional sequencing prompts. They do not grade a move as objectively optimal or calculate a win probability.
- The phone effect bundle is about 5 MiB and loads when a duel starts. Card illustrations and web fonts use external sources; the duel data and engine are bundled locally.
- Rooms have one host and one guest. There is no matchmaking, account system, ranked ladder, spectator mode, reconnect recovery, or best-of-three sideboarding flow.

Read [ARCHITECTURE.md](ARCHITECTURE.md) for module boundaries, data preparation, room transport, rule enforcement, testing, and extension notes. See [THIRD_PARTY.md](THIRD_PARTY.md) and [LICENSE](LICENSE) for source and license information.
