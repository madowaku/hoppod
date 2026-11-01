// Visual-only experiment. Physics, collisions and landing predictions are unchanged.
export const MARKER_MODES = Object.freeze(['full', 'neutral', 'off']);
export function markerModeFromUrl(href) {
  const url = new URL(href);
  // C is the adopted public policy. Old marker-only links must not silently
  // restore an experiment; A/B require the explicit developer comparison.
  if (url.searchParams.get('compare') !== '1') return 'off';
  const value = url.searchParams.get('marker');
  return MARKER_MODES.includes(value) ? value : 'off';
}
export function markerVisual(mode, safe) {
  if (mode === 'off') return { visible: false, color: null, hint: false };
  if (mode === 'neutral') return { visible: true, color: '#d2d2bc', hint: false };
  return { visible: true, color: safe ? '#8ee6c4' : '#ff9b80', hint: !safe };
}
