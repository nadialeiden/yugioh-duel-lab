const claimSlot = `
local count = tonumber(redis.call('GET', KEYS[1])) or 0
if count >= tonumber(ARGV[1]) then return 0 end
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])
return 1
`;

export function createGuestQuota({url, token} = {}) {
  const counts = new Map();
  const devices = new Set();
  let activeDay;
  return async ({ip, device, day, limit, secondsUntilReset}) => {
    if (url && token) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
        body: JSON.stringify(['EVAL', claimSlot, 2, `duel:guest:${day}:ip:${ip}`, `duel:guest:${day}:device:${device}`, limit, secondsUntilReset]),
        signal: AbortSignal.timeout(4000),
      });
      const data = await response.json();
      if (!response.ok || ![0, 1].includes(data.result)) throw new Error('Guest quota service unavailable');
      return data.result === 1;
    }
    if (activeDay !== day) {
      activeDay = day;
      counts.clear();
      devices.clear();
    }
    const count = counts.get(ip) ?? 0;
    if (count >= limit || devices.has(device)) return false;
    counts.set(ip, count + 1);
    devices.add(device);
    return true;
  };
}
