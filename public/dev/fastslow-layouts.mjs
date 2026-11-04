// Pure, testable geometry for the isolated FAST/SLOW play lab.
// Do not use these courses in production without real playtests.
export const TARGET_RADIUS = 12;
export const modeInfo = {
  precision: {
    name: 'A · PRECISION', goal: 2010,
    description: 'Land on the glowing center dots. Aim for as many PERFECT landings as you can.',
    centers: [610, 765, 918, 1088, 1238, 1418, 1570, 1746, 1889, 2050]
  },
  shortcut: {
    name: 'B · SHORTCUT', goal: 1995,
    description: 'Choose short, safe steps or risk longer hops to reach the flag in fewer jumps.'
  },
  relay: {
    name: 'C · DISCOVERY', goal: 1320,
    description: 'The way ahead has gone dark. A small signal post is wired to the missing bridge.'
  }
};
export const relayPlatforms = [[365, 500], [518, 635]];
export function makeLayout(selected) {
  if (selected === 'precision') return [
    [0, 520],
    ...modeInfo.precision.centers.map((x, i) => [x - (i % 3 === 1 ? 47 : 53), x + (i % 3 === 1 ? 47 : 53)])
  ];
  if (selected === 'shortcut') {
    const out = [[0, 520]];
    for (let i = 0; i < 15; i++) {
      const x = 610 + i * 102;
      out.push([x - (i % 4 === 2 ? 33 : 39), x + (i % 4 === 2 ? 33 : 39)]);
    }
    return out;
  }
  if (selected === 'relay') {
    return [[0, 245], [270, 350], [650, 810], [845, 1010], [1045, 1210], [1240, 1450]];
  }
  throw new RangeError('Unknown lab mode: ' + selected);
}
export const layouts = Object.fromEntries(Object.keys(modeInfo).map(k => [k, makeLayout(k)]));