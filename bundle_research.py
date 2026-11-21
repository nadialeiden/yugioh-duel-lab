"""Bundle verified AE research and project sources into browser assets."""
import datetime
import gzip
import json
import pathlib
import shutil
from collections import Counter
ROOT = pathlib.Path(__file__).resolve().parent
DATA = ROOT / 'dist/data'
def main():
    research = ROOT / 'research'
    pool = json.loads((research / 'ae-pool.json').read_text(encoding='utf-8-sig'))
    rules = json.loads((research / 'ae-rules.json').read_text(encoding='utf-8-sig'))
    evidence = json.loads((research / 'starter-card-evidence.json').read_text(encoding='utf-8-sig'))
    starters = json.loads((research / 'starters.json').read_text(encoding='utf-8-sig'))
    catalog = json.loads((DATA / 'catalog.json').read_text(encoding='utf-8-sig'))
    by_cid = {c['konami_id']: c for c in evidence}
    by_code = {c['code']: c for c in evidence}
    # Names differ between the AE and international text databases. Prefer IDs.
    pool_names = {c['name'].casefold(): c['konami_id'] for c in pool.get('cards', [])}
    allowed = set(pool['cids'])
    for c in catalog:
        if c['code'] in by_code:
            c['cid'] = by_code[c['code']]['konami_id']
        if not c.get('cid') and c['name'].casefold() in pool_names:
            c['cid'] = pool_names[c['name'].casefold()]
        c['ae'] = c.get('cid') in allowed
    releases = {str(c['code']): {'released': True, 'checked': True, 'checked_at': pool['checkedAt'], 'source': pool['source']} for c in catalog if c['ae']}
    releases.update({str(c['code']): c for c in evidence})
    recipes_path = research / 'additional-recipes.json'
    if recipes_path.exists():
        lookup = {}
        for card in sorted(catalog, key=lambda c: (bool(c['alias']), c['code'])):
            if card['ae'] and card['name'] not in lookup:
                lookup[card['name']] = card
        for recipe in json.loads(recipes_path.read_text(encoding='utf-8-sig')):
            deck = dict(id=recipe['id'], name=recipe['name'], main=[], extra=[], side=[],
                style=recipe.get('style', ''), description=recipe.get('description', ''),
                checkedAt=pool['checkedAt'], rulesDate=rules['date'],
                provenance={'kind': 'curated-practice', 'description': recipe.get('description', 'Curated AE practice deck; not a tournament result.'), 'source': pool['source']})
            quantities = Counter()
            for section in ['main', 'extra', 'side']:
                for name, count in recipe.get(section, {}).items():
                    if name not in lookup:
                        raise ValueError('No verified AE mapping for ' + name)
                    card = lookup[name]
                    extra_type = bool(card['type'] & (0x40 | 0x2000 | 0x800000 | 0x4000000))
                    if (section == 'extra' and not extra_type) or (section == 'main' and extra_type):
                        raise ValueError('Wrong deck section: ' + name)
                    quantities[card['cid']] += count
                    if quantities[card['cid']] > rules['konami_id_limits'].get(str(card['cid']), 3):
                        raise ValueError('AE copy limit exceeded: ' + name)
                    deck[section].extend([card['code']] * count)
            if len(deck['main']) != 40 or len(deck['extra']) > 15 or len(deck['side']) > 15:
                raise ValueError('Invalid practice deck sizes: ' + deck['name'])
            starters.append(deck)
    payload = {'decks': starters, 'releases': releases, 'poolCheckedAt': pool['checkedAt'], 'poolCount': pool['count'], 'matchedCount': sum(c['ae'] for c in catalog)}
    for filename, value in [('ae-rules.json', rules), ('starters.json', payload), ('catalog.json', catalog)]:
        (DATA / filename).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    # The raw official HTML stays in research; only structured facts ship to browsers.
    for file in (ROOT / 'dist').rglob('*'):
        if file.is_file() and file.suffix in ('.json', '.js', '.mjs', '.css', '.html', '.conf') and file.stat().st_size > 1024:
            file.with_name(file.name + '.gz').write_bytes(gzip.compress(file.read_bytes(), mtime=0))
    print('AE catalog:', payload['matchedCount'], 'mapped passcodes from', pool['count'], 'official identities; list', rules['date'], '; practice decks:', len(starters))
if __name__ == '__main__':
    main()
