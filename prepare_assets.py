"""Fetch and bundle the public Project Ignis engine data for browser-local duels."""
import concurrent.futures
import json
import pathlib
import shutil
import sqlite3
import tempfile
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / 'dist'
DATA = OUT / 'data'
DATA.mkdir(parents=True, exist_ok=True)

def fetch(url):
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'AE-Duel-Lab/1.0'})
            with urllib.request.urlopen(request, timeout=90) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))

def database(entry):
    raw = fetch(entry['download_url'])
    with tempfile.NamedTemporaryFile(suffix='.cdb', delete=False) as f:
        f.write(raw)
        path = pathlib.Path(f.name)
    try:
        connection = sqlite3.connect(str(path))
        connection.row_factory = sqlite3.Row
        rows = connection.execute('SELECT d.*, t.name, t.desc, ' + ','.join('t.str' + str(n) for n in range(1, 17)) + ' FROM datas d JOIN texts t ON d.id=t.id').fetchall()
        result = []
        for row in rows:
            d = dict(row)
            # Keep the actual core data. Unreleased and alternate-format entries
            # stay out of the deck builder rather than becoming fake legal cards.
            if not d['ot'] & 1 or d['ot'] & (4 | 8 | 16 | 32 | 64 | 256 | 512 | 4096):
                continue
            setcode = int(d['setcode']) & ((1 << 64) - 1)
            result.append(dict(code=d['id'], name=d['name'], text=d['desc'],
                ot=d['ot'], alias=d['alias'], setcodes=[(setcode >> n) & 65535 for n in range(0, 64, 16) if (setcode >> n) & 65535],
                type=d['type'], attack=d['atk'], defense=0 if d['type'] & 0x4000000 else d['def'],
                level=d['level'] & 255, lscale=(d['level'] >> 24) & 255, rscale=(d['level'] >> 16) & 255,
                race=str(d['race']), attribute=d['attribute'], link_marker=d['def'] if d['type'] & 0x4000000 else 0,
                strings=[d['str' + str(n)] or '' for n in range(1, 17)]))
        connection.close()
        return result
    finally:
        path.unlink(missing_ok=True)

def main():
    entries = json.loads(fetch('https://api.github.com/repos/ProjectIgnis/BabelCDB/contents/'))
    entries = [e for e in entries if e['name'].endswith('.cdb') and (e['name'] in ('official.cdb', 'cards.cdb') or e['name'].lower().startswith('release')) and not any(s in e['name'].lower() for s in ['rush', 'skill', 'speed'])]
    cards = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        for batch in pool.map(database, entries):
            for card in batch:
                cards[card['code']] = card
    print('Bundled', len(cards), 'released OCG cards from', len(entries), 'databases.', flush=True)
    try:
        meta = json.loads(fetch('https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes'))
        for card in meta.get('data', []):
            misc = (card.get('misc_info') or [{}])[0]
            if card['id'] in cards and misc.get('konami_id'):
                cards[card['id']]['cid'] = misc['konami_id']
    except Exception as error:
        print('Optional card-ID enrichment unavailable:', type(error).__name__, flush=True)
    (DATA / 'catalog.json').write_text(json.dumps(list(cards.values()), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (DATA / 'scripts.zip').write_bytes(fetch('https://codeload.github.com/ProjectIgnis/CardScripts/zip/refs/heads/master'))
    (DATA / 'strings.conf').write_bytes(fetch('https://raw.githubusercontent.com/ProjectIgnis/Distribution/master/config/strings.conf'))
    engine = ROOT / 'node_modules' / 'ocgcore-wasm' / 'dist'
    target = OUT / 'vendor' / 'ocg'
    target.mkdir(parents=True, exist_ok=True)
    for source in engine.glob('*.js'):
        shutil.copy2(source, target / source.name)
    shutil.copy2(ROOT / 'node_modules/fflate/esm/browser.js', OUT / 'vendor/fflate.mjs')
    (DATA / 'asset-info.json').write_text(json.dumps({'preparedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'engine': 'ocgcore-wasm 0.1.7', 'cards': len(cards), 'sources': ['https://github.com/ProjectIgnis/BabelCDB', 'https://github.com/ProjectIgnis/CardScripts']}), encoding='utf-8')
    print('Browser engine and scripts ready.', flush=True)

if __name__ == '__main__':
    main()
