// STORY copy (display only). English by default; Japanese on request (?lang=
// or the saved choice), sharing the FREE RUN preference key.
export { chooseLanguage, withLanguage } from '../ui-copy.mjs';
const TEXT = Object.freeze({
  en: Object.freeze({
    tag: 'STORY', free: 'FREE RUN ›', title: 'RAPIPPO', subtitle: 'One hop. One beat. A song is born.',
    autoHop: 'It hops by itself. Hold to go farther.',
    begin: 'STORY', freeRun: 'FREE RUN', headphones: '♪ Sound on. Headphones recommended.', hold: 'HOLD', release: 'LET GO',
    pauseTitle: 'PAUSED', pauseText: 'The beat waits for you.', resume: 'RESUME', again: 'PLAY AGAIN',
    toFast: 'HOLD TO GO FAST', toSlow: 'RELEASE TO SLOW', soundOn: 'SOUND ON', soundOff: 'SOUND OFF', buzzOn: 'BUZZ ON', buzzOff: 'BUZZ OFF',
    footer: 'A tiny capsule. A moon full of music.', keys: 'SPACE = HOLD · ESC = PAUSE', switchLanguage: 'Switch to Japanese',
    hints: ['IT HOPS ON THE BEAT.', 'HOLD → FAST', 'RELEASE → SLOW'],
    chapters: { wake: 'I · WIND-UP', apart: 'II · APART', rescue: 'III · FETCH', base: 'IV · BASE', send: 'V · SEND' },
    thanks: 'THANK YOU FOR PLAYING',
  }),
  ja: Object.freeze({
    tag: 'ストーリー', free: 'フリーラン ›', title: 'RAPIPPO', subtitle: 'ひとりのジャンプから、月面に音楽が生まれる。',
    autoHop: '自動でジャンプ。押し続けると遠くへ。',
    begin: 'ストーリー', freeRun: 'フリーラン', headphones: '♪ 音を出して遊んでください。ヘッドホン推奨。', hold: '押す', release: '離す',
    pauseTitle: 'ひとやすみ', pauseText: '拍は待っています。', resume: 'つづける', again: 'もう一度',
    toFast: '押してFAST', toSlow: '離してSLOW', soundOn: '音 ON', soundOff: '音 OFF', buzzOn: '振動 ON', buzzOff: '振動 OFF',
    footer: '小さなカプセルと、音楽が生まれる月。', keys: 'SPACE = 押す · ESC = 一時停止', switchLanguage: 'Switch to English',
    hints: ['拍にあわせて自動でジャンプ', '押す → FAST', '離す → SLOW'],
    chapters: { wake: 'I · ゼンマイ', apart: 'II · はなれる', rescue: 'III · むかえに', base: 'IV · 月面基地', send: 'V · とどける' },
    thanks: 'あそんでくれて、ありがとう',
  }),
});
export const storyCopy = (language, key) => (TEXT[language] || TEXT.en)[key];
