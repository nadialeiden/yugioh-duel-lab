"""Bundle verified AE research and project sources into browser assets."""
import datetime
import gzip
import json
import pathlib
import shutil
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
    payload = {'decks': starters, 'releases': releases, 'poolCheckedAt': pool['checkedAt'], 'poolCount': pool['count'], 'matchedCount': sum(c['ae'] for c in catalog)}
    for filename, value in [('ae-rules.json', rules), ('starters.json', payload), ('catalog.json', catalog)]:
        (DATA / filename).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    # The raw official HTML stays in research; only structured facts ship to browsers.
    for file in (ROOT / 'dist').rglob('*'):
        if file.is_file() and file.suffix in ('.json', '.js', '.mjs', '.css', '.html', '.conf') and file.stat().st_size > 1024:
            file.with_name(file.name + '.gz').write_bytes(gzip.compress(file.read_bytes(), mtime=0))
    print('AE catalog:', payload['matchedCount'], 'mapped passcodes from', pool['count'], 'official identities; list', rules['date'])
if __name__ == '__main__':
    main()
