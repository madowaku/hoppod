// Visual-only experiment. Physics, collisions and landing predictions are unchanged.
export const MARKER_MODES = Object.freeze(['full', 'neutral', 'off']);
export function markerModeFromUrl(href) {
  const value = new URL(href).searchParams.get('marker');
  return MARKER_MODES.includes(value) ? value : 'full';
}
export function markerVisual(mode, safe) {
  if (mode === 'off') return { visible: false, color: null, hint: false };
  if (mode === 'neutral') return { visible: true, color: '#d2d2bc', hint: false };
  return { visible: true, color: safe ? '#8ee6c4' : '#ff9b80', hint: !safe };
}
