// Tower copy (display only). Language rules are shared with the rest of RAPIPPO.
export { chooseLanguage, withLanguage } from '../ui-copy.mjs';
const TEXT = Object.freeze({
  en: Object.freeze({
    tag: 'THE SUNWISE CLOCK TOWER', title: 'RAPIPPO', subtitle: 'The clock stopped at five to midnight. Bring it the morning.',
    autoHop: 'It hops by itself. Hold to go farther.', headphones: '♪ Sound on. Headphones recommended.',
    begin: 'CLIMB', restart: 'START OVER', cont: 'CONTINUE', hold: 'HOLD', release: 'LET GO',
    pause: 'Pause', pauseTitle: 'PAUSED', pauseText: 'The tower waits for you.', resume: 'RESUME', again: 'PLAY AGAIN', stages: 'STAGES ›',
    toFast: 'HOLD TO GO FAST', toSlow: 'RELEASE TO SLOW', soundOn: 'SOUND ON', soundOff: 'SOUND OFF', buzzOn: 'BUZZ ON', buzzOff: 'BUZZ OFF',
    footer: 'A tiny capsule. A clock that stopped.', keys: 'SPACE = HOLD · ESC = PAUSE', switchLanguage: 'Switch to Japanese',
    stations: { foot: 'THE FOOT OF THE TOWER', pendulum: 'PENDULUM HALL', teeth: 'THE ESCAPEMENT', spring: 'THE MAINSPRING', sand: 'THE HOURGLASS', hands: 'BRIDGE OF HANDS', machine: 'THE MACHINE ROOM', bell: 'THE BELFRY' },
    finds: {
      foot: 'The clock above stopped at five to midnight.', pendulum: 'Long ones sweep the floor: be in the air. Short ones sweep high: stay low.',
      teeth: 'Gold stands on the tick, silver on the tock. Land on the tooth that is up.', spring: 'Land on a coil and your next hop goes much farther.',
      sand: 'Sand holds you once. Never land on the same sand twice.', hands: 'On a cog, SLOW hops on the spot. Three small lamps count in. On the big lamp, FAST onto the hand.',
      machine: 'Every mechanism, turning together.', bell: 'Ring the bell at the top.',
    },
    hints: { hit: 'Watch the swing. Change how far you hop.', tick: 'Land on the tooth that is lit.', tock: 'Land on the tooth that is lit.', sand: 'Only once on sand. Hop long to the next.', hand: 'Wait on the cog with SLOW. Big lamp lit: FAST.', gap: 'Hold longer to reach farther.', spring: 'After a coil, even SLOW goes far.' },
    assist: 'The tower slows down for you.', gears: 'GEARS',
    heart: 'Rapippo became the heart of the clock', every: 'Every hop moves the hands', dawn: 'And the sun came round', end: 'The clock you set going brought the morning.',
    gearLine: n => `Gears found: ${n}/12`,
  }),
  ja: Object.freeze({
    tag: '陽周りの時計台', title: 'RAPIPPO', subtitle: '真夜中の5分前で止まった時計に、朝を連れてこよう。',
    autoHop: '自動でジャンプ。押し続けると遠くへ。', headphones: '♪ 音を出して遊んでください。ヘッドホン推奨。',
    begin: 'のぼる', restart: 'はじめから', cont: 'つづきから', hold: '押す', release: '離す',
    pause: '一時停止', pauseTitle: 'ひとやすみ', pauseText: '時計台は待っています。', resume: 'つづける', again: 'もう一度', stages: 'ステージ ›',
    toFast: '押してFAST', toSlow: '離してSLOW', soundOn: '音 ON', soundOff: '音 OFF', buzzOn: '振動 ON', buzzOff: '振動 OFF',
    footer: '小さなカプセルと、止まった時計。', keys: 'SPACE = 押す · ESC = 一時停止', switchLanguage: 'Switch to English',
    stations: { foot: '塔のふもと', pendulum: '振り子の回廊', teeth: '脱進機の歯', spring: 'ゼンマイ', sand: '砂時計', hands: '針の橋', machine: '機械室', bell: '鐘楼' },
    finds: {
      foot: '上の時計は、真夜中の5分前で止まっている。', pendulum: '長い振り子は空中で、短い振り子は低くかわす。',
      teeth: '金は表拍、銀は裏拍に立つ。立っている歯へ。', spring: 'ゼンマイを踏むと、次のひと跳びが大きく伸びる。',
      sand: '砂は一度きり。同じ砂に二度は乗れない。', hands: '歯車の上ではSLOWでその場跳び。小さなランプが3つ数えたら、大きなランプでFAST。',
      machine: 'ぜんぶの仕掛けが、いっしょに回る。', bell: 'てっぺんの鐘を鳴らそう。',
    },
    hints: { hit: '振り子をよく見て、跳ぶ幅を変えよう。', tick: '光っている歯に着地しよう。', tock: '光っている歯に着地しよう。', sand: '砂は一度だけ。長く跳んで次へ。', hand: '歯車の上でSLOWのまま待って、大きなランプが灯ったらFAST。', gap: '長く押すと、遠くへ届く。', spring: 'ゼンマイの後は、SLOWでも遠くまで跳ぶ。' },
    assist: '時計台が、ゆっくり待ってくれる。', gears: '歯車',
    heart: 'ラピッポが、時計の心臓になった', every: 'ひと跳びごとに、針が進む', dawn: 'そして、お日さまが回ってきた', end: 'あなたが動かした時計が、朝を連れてきた。',
    gearLine: n => `見つけた歯車 ${n}/12`,
  }),
});
export const towerCopy = (language, key) => (TEXT[language] || TEXT.en)[key];
