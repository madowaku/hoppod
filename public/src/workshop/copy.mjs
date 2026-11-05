// Workshop copy (display only). Language rules are shared with the rest of RAPIPPO.
export { chooseLanguage, withLanguage } from '../ui-copy.mjs';
const TEXT = Object.freeze({
  en: Object.freeze({
    tag: 'MOON WORKSHOP', title: 'RAPIPPO', subtitle: 'Wake the instruments. Finish the song.',
    autoHop: 'It hops by itself. Hold to go farther.', headphones: '♪ Sound on. Headphones recommended.',
    begin: 'ENTER', cont: 'CONTINUE', free: 'FREE PLAY', hold: 'HOLD', release: 'LET GO',
    pause: 'Pause', pauseTitle: 'PAUSED', pauseText: 'The beat waits for you.', resume: 'RESUME', again: 'PLAY AGAIN', toTitle: 'TITLE',
    toFast: 'HOLD TO GO FAST', toSlow: 'RELEASE TO SLOW', soundOn: 'SOUND ON', soundOff: 'SOUND OFF', buzzOn: 'BUZZ ON', buzzOff: 'BUZZ OFF',
    footer: 'A tiny capsule. A workshop full of sleeping sound.', keys: 'SPACE = HOLD · ESC = PAUSE', switchLanguage: 'Switch to Japanese',
    thanks: 'It keeps going without you.', savePng: 'SAVE SCORE', copyLink: 'COPY LINK', copied: 'COPIED', listening: 'Someone left this song in the workshop.', listenOwn: 'ENTER THE WORKSHOP',
    freeTitle: 'FREE PLAY', freeHint: 'Hold: a wider swing, a bigger sound. Press: your own breath. The beat never moves.', leave: 'LEAVE',
    stations: {
      hall: 'THE SILENT HALL', drums: 'DRUMS', tongue: 'TONGUE DRUM', keys: 'KEYS', harp: 'HARP', strings: 'STRINGS',
      wood: 'WOODWIND', bellows: 'BELLOWS', brass: 'TROMBONE', cymbal: 'CYMBALS', metronome: 'THE METRONOME',
    },
    finds: {
      hall: 'Only your tick is left in the building.', drums: 'Where you land is what sounds.', tongue: 'What you strike wakes its own kind ahead.',
      keys: 'No holes here. How far you hop is the interval.', harp: 'Up here the sky has strings. FAST sweeps.', strings: 'Same pad, different sound. It depends when you press.',
      wood: 'Every press is a note. Wide gaps need long ones.', bellows: 'Gold takes a push (FAST). Blue takes a draw (SLOW).', brass: 'On the cart, FAST goes forward and SLOW goes back.',
      cymbal: 'Its ring is the only light.', metronome: 'It has lost its weight.',
    },
    resHint: 'Only what you struck is solid.', cartHint: 'Hold half a hop to stay put.',
    tags: { drums: 'drums', tongue: 'tongue drum', keys: 'keys', harp: 'harp', strings: 'strings', wood: 'your breath', bellows: 'bellows', brass: 'trombone' },
  }),
  ja: Object.freeze({
    tag: '月の楽器工房', title: 'RAPIPPO', subtitle: '音を起こして、曲を完成させる。',
    autoHop: '自動でジャンプ。押し続けると遠くへ。', headphones: '♪ 音を出して遊んでください。ヘッドホン推奨。',
    begin: 'はいる', cont: 'つづきから', free: '自由演奏', hold: '押す', release: '離す',
    pause: '一時停止', pauseTitle: 'ひとやすみ', pauseText: '拍は待っています。', resume: 'つづける', again: 'もう一度', toTitle: 'タイトル',
    toFast: '押してFAST', toSlow: '離してSLOW', soundOn: '音 ON', soundOff: '音 OFF', buzzOn: '振動 ON', buzzOff: '振動 OFF',
    footer: '小さなカプセルと、眠っている音の工房。', keys: 'SPACE = 押す · ESC = 一時停止', switchLanguage: 'Switch to English',
    thanks: 'あなたがいなくても、続いていく。', savePng: '楽譜を保存', copyLink: 'リンクをコピー', copied: 'コピーしました', listening: 'だれかが工房に残していった曲です。', listenOwn: '工房にはいる',
    freeTitle: '自由演奏', freeHint: '押すと振れ幅と音が大きく、押した瞬間は自分の息に。拍は動きません。', leave: 'でる',
    stations: {
      hall: '音のない広間', drums: '打楽器', tongue: 'タングドラム', keys: '鍵盤', harp: 'ハープ', strings: '弦',
      wood: '木管', bellows: '蛇腹', brass: 'トロンボーン', cymbal: 'シンバル', metronome: 'メトロノーム',
    },
    finds: {
      hall: 'この建物に残った音は、あなたのチックだけ。', drums: '着地した場所が、音になる。', tongue: '鳴らした音が、先の同じ音を起こす。',
      keys: '穴はない。跳ぶ幅が音程になる。', harp: '空にも弦がある。FASTで払う。', strings: '同じ足場でも、押す時で音が変わる。',
      wood: '押した瞬間が音。広い谷は長く吹く。', bellows: '金は押す（FAST）、青は引く（SLOW）で乗れる。', brass: '台車の上なら、FASTで前へ、SLOWで後ろへ。',
      cymbal: '余韻だけが、明かりになる。', metronome: '重りを失っている。',
    },
    resHint: '鳴らした音の足場だけ固い。', cartHint: '半分押すと、その場にとどまる。',
    tags: { drums: '打楽器', tongue: 'タングドラム', keys: '鍵盤', harp: 'ハープ', strings: '弦', wood: 'あなたの息', bellows: '蛇腹', brass: 'トロンボーン' },
  }),
});
export const workshopCopy = (language, key) => (TEXT[language] || TEXT.en)[key];
