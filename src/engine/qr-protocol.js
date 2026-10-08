const V = 'KR1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const URL_CARD = /[#?](\/p\/|u=)?([0-9a-f-]{36})\/?$/i;

export const encodeP = (uuid) => `${V}|P|${uuid}`;
export const encodeR = (uuid, id, item, qty, ymd) => `${V}|R|${uuid}|${id}|${item}.${qty}|${ymd}`;

export function generateQRUrl(params) {
  const uuid = typeof params === 'string' ? params : params.uuid;
  let path = window.location.pathname.replace(/\/teacher(\/.*)?$/i, '/').replace(/\/index\.html$/i, '/');
  if (!path.endsWith('/')) path += '/';
  return `${window.location.origin}${path}?u=${uuid}#/p/${uuid}`;
}

export function decode(text) {
  const t = String(text).trim();
  
  // Direct UUID match
  if (UUID.test(t)) {
    return { type: 'P', uuid: t.toLowerCase() };
  }

  // Card URL with hash or param
  const urlMatch = t.match(URL_CARD);
  if (urlMatch && UUID.test(urlMatch[2])) {
    return { type: 'P', uuid: urlMatch[2].toLowerCase() };
  }

  // Any URL containing a valid UUID
  const anyUuidMatch = t.match(/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
  if (t.includes('http') && anyUuidMatch) {
    return { type: 'P', uuid: anyUuidMatch[1].toLowerCase() };
  }

  // Legacy zk:student:<uuid>
  if (t.startsWith('zk:student:')) {
    const rawUuid = t.replace('zk:student:', '');
    if (UUID.test(rawUuid)) return { type: 'P', uuid: rawUuid.toLowerCase() };
  }

  const parts = t.split('|');
  const [v, kind, uuid, id, body, ymd] = parts;
  if (v !== V || !UUID.test(uuid ?? '')) {
    throw new Error('bad-qr');
  }

  if (kind === 'P') {
    return { type: 'P', uuid };
  }

  if (kind === 'R') {
    const [item, qty] = (body ?? '').split('.');
    const q = Number(qty);
    if (!/^[a-z0-9_]{2,24}$/.test(item ?? '') || !Number.isInteger(q) || q < 1 || q > 10 || !/^\d{6}$/.test(ymd ?? '')) {
      throw new Error('bad-qr');
    }
    return { type: 'R', uuid, id, item, qty: q, ymd };
  }

  throw new Error('bad-qr');
}

export const parseQR = decode;
