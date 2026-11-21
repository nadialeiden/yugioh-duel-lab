"""Refresh official Asian-English legality snapshots. Requires requests, beautifulsoup4.

Run from any directory: python research/refresh_ae_data.py
Use --skip-pool to refresh only the restriction list and regenerate starter decks.
This does not assert that all cards have implemented simulator scripts.
"""
import argparse
import datetime as dt
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
BANLIST = 'https://www.db.yugioh-card.com/yugiohdb/forbidden_limited.action?request_locale=ae'
POOL = 'https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&request_locale=ae&rp=100&stype=1&keyword='


def get(url):
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=90, headers={'User-Agent': 'AE-Duel-Lab-Personal-Practice/1.0'})
            r.raise_for_status()
            if 'text/html' not in r.headers.get('content-type', ''):
                raise ValueError('Official source did not return HTML')
            soup = BeautifulSoup(r.text, 'html.parser')
            lang = soup.find('meta', attrs={'http-equiv': 'Content-Language'})
            if not lang or lang.get('content') != 'ae':
                raise ValueError('Source did not return the Asian-English locale')
            return soup
        except (requests.RequestException, ValueError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def save(name, data):
    target = ROOT / name
    temp = target.with_suffix(target.suffix + '.tmp')
    temp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    temp.replace(target)


def restrictions(as_of):
    soup = get(BANLIST)
    effective = soup.select_one('#forbiddenLimitedDate option')['value']
    if effective > as_of:
        raise ValueError('Official response shows a future list; do not apply it before its effective date')
    limits, ids = {}, {}
    for section, limit in [('list_forbidden', 0), ('list_limited', 1), ('list_semi_limited', 2)]:
        container = soup.select_one('#' + section)
        rows = container.select('.t_row')
        expected = int(re.search(r'(\d+) Card', container.select_one('h3').get_text(' ', strip=True)).group(1))
        if len(rows) != expected:
            raise ValueError('Restriction table is incomplete: ' + section)
        for row in rows:
            name = re.sub(r' \(Updated from:.*\)$', '', row.select_one('.name').get_text(strip=True))
            cid = re.search(r'cid=(\d+)', row.select_one('input.link_value')['value']).group(1)
            limits[name] = limit
            ids[cid] = limit
    if len(limits) < 40:
        raise ValueError('Restriction response is unexpectedly short')
    result = {'date': effective, 'checkedAt': as_of, 'format': 'OCG-AE', 'source': BANLIST,
              'secondary_source': 'https://www.yugioh-card.com/asia/play/forbidden-and-limited-card-list-ae/',
              'limits': limits, 'konami_id_limits': ids,
              'counts': {str(n): sum(v == n for v in limits.values()) for n in [0, 1, 2]}}
    save('ae-rules.json', result)
    print('AE restrictions:', effective, result['counts'], flush=True)
    return result


def parse_pool_page(soup, page):
    current = soup.select_one('.nowpage')
    if not current or current.get_text(strip=True) != str(page):
        raise ValueError('Official pagination did not return expected page ' + str(page))
    cards = []
    for row in soup.select('.t_row'):
        cid = row.select_one('input.cid')
        name = row.select_one('.card_name')
        if cid and name:
            cards.append({'konami_id': int(cid['value']), 'name': name.get_text(strip=True)})
    if not cards or len(cards) > 100:
        raise ValueError('Unexpected card count on page ' + str(page))
    return cards


def pool(as_of):
    first = get(POOL + '&page=1')
    pages = [int(n) for a in first.select('.page_num a') for n in re.findall(r'ChangePage\((\d+)\)', a.get('href', ''))]
    last = max(pages + [1])
    by_page = {1: parse_pool_page(first, 1)}

    def worker(page):
        time.sleep(0.2)
        return page, parse_pool_page(get(POOL + '&page=' + str(page)), page)

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(worker, page) for page in range(2, last + 1)]
        for future in as_completed(futures):
            page, cards = future.result()
            by_page[page] = cards
            print('AE pool page', page, '/', last, flush=True)
    all_cards = []
    for page in range(1, last + 1):
        cards = by_page[page]
        if page < last and len(cards) != 100:
            raise ValueError('Incomplete non-final page ' + str(page))
        all_cards.extend(cards)
    cids = [c['konami_id'] for c in all_cards]
    if len(cids) != len(set(cids)) or len(cids) < 1000:
        raise ValueError('AE pool has duplicate IDs or an unexpected total; retain previous snapshot')
    result = {'checkedAt': as_of, 'source': POOL, 'format': 'OCG-AE', 'pages': last,
              'count': len(cids), 'cids': sorted(cids), 'cards': all_cards,
              'releasePolicy': 'Official English(Asia) Card Search results; Konami says card information becomes available from release date. Unreleased simulator entries must additionally be excluded by their OCG prerelease scope.'}
    save('ae-pool.json', result)
    print('Official AE pool:', len(cids), 'unique cards across', last, 'pages', flush=True)
    return result


EXOSISTER_MAIN = {
    'Exosister Martha': 3, 'Exosister Elis': 3, 'Exosister Stella': 2,
    'Exosister Sophia': 1, 'Exosister Irene': 1, 'Aratama': 3, 'Sakitama': 3,
    'Ash Blossom & Joyous Spring': 2, 'Maxx "C"': 1, 'Dimension Shifter': 1,
    'Nibiru, the Primal Being': 2, 'Ghost Ogre & Snow Rabbit': 2,
    'Exosister Pax': 3, 'Called by the Grave': 2, 'Crossout Designator': 1,
    'Triple Tactics Talent': 2, 'Exosister Vadis': 2, 'Exosister Returnia': 3,
    'Infinite Impermanence': 3}
EXOSISTER_EXTRA = {'Exosisters Magnifica': 3, 'Exosister Mikailis': 3,
    'Exosister Kaspitell': 3, 'Exosister Gibrine': 3, 'Exosister Asophiel': 3}
SWORDSOUL_MAIN = {'Swordsoul of Mo Ye': 3, 'Swordsoul of Taia': 2,
    'Swordsoul Strategist Longyuan': 3, 'Incredible Ecclesia, the Virtuous': 3,
    'Tenyi Spirit - Adhara': 3, 'Tenyi Spirit - Vishuda': 2, 'Tenyi Spirit - Ashuna': 3,
    'Tenyi Spirit - Shthana': 1, 'Effect Veiler': 3, 'Maxx "C"': 1,
    'Ash Blossom & Joyous Spring': 2, 'Swordsoul Emergence': 3,
    'Swordsoul Sacred Summit': 1, 'Heavenly Dragon Circle': 2,
    'Vessel for the Dragon Cycle': 2, 'Called by the Grave': 2,
    'Raigeki': 1, "Harpie's Feather Duster": 1, 'Swordsoul Blackout': 2}
SWORDSOUL_EXTRA = {'Swordsoul Grandmaster - Chixiao': 2,
    'Swordsoul Supreme Sovereign - Chengying': 2,
    'Swordsoul Sinister Sovereign - Qixing Longyuan': 2, 'Draco Berserker of the Tenyi': 2,
    'Baxia, Brightness of the Yang Zing': 2, 'Yazi, Evil of the Yang Zing': 1,
    'Chaofeng, Phantom of the Yang Zing': 1, 'Adamancipator Risen - Dragite': 1,
    'Monk of the Tenyi': 1, 'Shaman of the Tenyi': 1}


def starters(rules, as_of):
    evidence_path = ROOT / 'starter-card-evidence.json'
    if not evidence_path.exists():
        print('No individual evidence file yet; skipping starter generation', flush=True)
        return
    evidence = json.loads(evidence_path.read_text(encoding='utf-8-sig'))
    by_name = {c['name']: c for c in evidence}
    snapshots = []
    for key, name, main, extra, pid in [
        ('exosister', 'Exosister - AE practice', EXOSISTER_MAIN, EXOSISTER_EXTRA, 5000001474000),
        ('swordsoul', 'Swordsoul Tenyi - AE practice', SWORDSOUL_MAIN, SWORDSOUL_EXTRA, 5000001419000)]:
        deck = {'id': key, 'name': name, 'main': [], 'extra': [], 'side': [],
                'provenance': {'kind': 'curated-practice', 'description': 'Curated practice list using AE-released cards; not a tournament result or an exact sealed deck recipe.',
                  'source': 'https://www.db.yugioh-card.com/yugiohdb/card_search.action?ope=1&sess=1&pid=' + str(pid) + '&rp=99999&request_locale=ae'},
                'checkedAt': as_of, 'rulesDate': rules['date']}
        for section, quantities in [('main', main), ('extra', extra)]:
            for card_name, quantity in quantities.items():
                card = by_name[card_name]
                if not card['released']:
                    raise ValueError('No AE release evidence: ' + card_name)
                limit = rules['konami_id_limits'].get(str(card['konami_id']), 3)
                if quantity > limit:
                    raise ValueError('Starter needs revision for current limits: ' + card_name)
                deck[section].extend([card['code']] * quantity)
        if len(deck['main']) != 40 or len(deck['extra']) > 15:
            raise ValueError('Invalid starter deck size')
        snapshots.append(deck)
    save('starters.json', snapshots)
    print('Prepared starters:', [(x['name'], len(x['main']), len(x['extra'])) for x in snapshots], flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--as-of', default=dt.date.today().isoformat())
    parser.add_argument('--skip-pool', action='store_true')
    args = parser.parse_args()
    dt.date.fromisoformat(args.as_of)
    rules = restrictions(args.as_of)
    if not args.skip_pool:
        pool(args.as_of)
    starters(rules, args.as_of)


if __name__ == '__main__':
    main()
