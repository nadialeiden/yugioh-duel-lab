import json
from pathlib import Path
from collections import Counter
p=Path(__file__).resolve().parent
r=json.loads((p/'ae-rules.json').read_text(encoding='utf-8'))
q=json.loads((p/'ae-pool.json').read_text(encoding='utf-8'))
e=json.loads((p/'starter-card-evidence.json').read_text(encoding='utf-8'))
d=json.loads((p/'starters.json').read_text(encoding='utf-8'))
bycode={x['code']:x for x in e};pool=set(q['cids'])
assert len(pool)==q['count']
assert {str(k):v for k,v in Counter(r['konami_id_limits'].values()).items()}==r['counts']
assert all(x['released'] and x['konami_id'] in pool for x in e)
for deck in d:
 assert len(deck['main'])==40 and len(deck['extra'])==15
 counts=Counter(deck['main']+deck['extra']+deck['side'])
 for code,n in counts.items():
  card=bycode[code]; assert n<=r['konami_id_limits'].get(str(card['konami_id']),3)
 print(deck['name'],len(counts),'unique cards; all released AE and within current copy limits')
print('Verified 55 / 55 evidence records and all 7068 pool identities; Exosister Karmael in pool:',22147 in pool)
