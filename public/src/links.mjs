import { hashSeed, COURSE_VERSION } from './engine.mjs';

export function jstDate(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function resolveRun(href, today = jstDate(), random = () => crypto.getRandomValues(new Uint32Array(1))[0]) {
  const url = new URL(href);
  const mode = url.searchParams.get('mode') === 'free' ? 'free' : 'daily';
  const date = validDate(url.searchParams.get('date')) ? url.searchParams.get('date') : today;
  const raw = url.searchParams.get('seed');
  // The daily salt predates the RAPIPPO name; keep it so dated courses replay.
  const seed = mode === 'daily' ? hashSeed('HOPPOD-' + date) :
    (raw !== null && /^\d{1,10}$/.test(raw) && Number(raw) <= 0xffffffff ? Number(raw) >>> 0 : random() >>> 0);
  url.search = '';
  url.hash = '';
  url.searchParams.set('mode', mode);
  url.searchParams.set(mode === 'daily' ? 'date' : 'seed', mode === 'daily' ? date : String(seed));
  // Terrain versions are explicit; v3 merged invisible seams (see docs/V03_FAIR_GROUND.md).
  url.searchParams.set('v', String(COURSE_VERSION));
  return { mode, date, seed, url: url.href };
}
export function shareUrl(run, hops, best) {
  const url = new URL('https://twitter.com/intent/tweet');
  url.searchParams.set('text', `RAPIPPO 🚀 ${hops} HOPS · BEST ${best}\nONE MORE HOP! #RAPIPPO`);
  url.searchParams.set('url', run.url);
  return url.href;
}
