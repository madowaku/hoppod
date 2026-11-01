// Small, dependency-free JA/EN copy layer. Display only: never used for
// course seeds, scoring, terrain, collision or storage namespace selection.
export const LANGUAGES = Object.freeze(['ja','en']);
export function chooseLanguage(url, stored, browser = 'en') {
  const query = new URL(url).searchParams.get('lang');
  if (LANGUAGES.includes(query)) return query;
  if (LANGUAGES.includes(stored)) return stored;
  return /^ja(?:-|$)/i.test(browser) ? 'ja' : 'en';
}
const TEXT = Object.freeze({
  en: Object.freeze({
    tagline:'ONE MORE HOP!', hops:'HOPS', best:'BEST', daily:'DAILY', free:'FREE RUN',
    introMark:'✦ LUNAR DELIVERY SERVICE ✦',
    startTitle:'ONE MORE HOP!', startText:'It hops. You set the pace.', startButton:'LET’S HOP',
    pauseTitle:'TAKE A BREATHER.', pauseText:'Resume at SLOW.', pauseButton:'RESUME',
    recordTitle:'A NEW LITTLE RECORD.', resultTitle:'ONE MORE HOP?', retryButton:'TRY AGAIN',
    short:'TOO SHORT · HOLD A LITTLE LONGER', far:'TOO FAR · RELEASE A LITTLE EARLIER',
    hold:'HOLD', release:'LET GO', toFast:'HOLD TO GO FAST', toSlow:'RELEASE TO SLOW',
    soundOn:'SOUND ON', soundOff:'SOUND OFF',
    share:'POST TO X ↗', save:'SAVE PNG ↓', attach:'Attach your PNG to X yourself.',
    footer:'A tiny capsule. An endless moon.', keys:'SPACE = HOLD · R = RETRY',
    switchLanguage:'Switch to Japanese', parts:'BLUE POD PARTS', crew:'WITH BLUE POD',
    labels:{antenna:'ANTENNA',body:'BODY',engine:'ENGINE'},
    milestone:n=>n+' HOPS! ♪', record:'NEW BEST! ✦',
    earth:{'FAR SIDE':'FAR SIDE','EARTHGLOW':'EARTHGLOW','FULL EARTH':'FULL EARTH'},
    scoreDaily:date=>'DAILY MOON / '+date,scoreFree:seed=>'FREE RUN / '+seed,
    modeDaily:date=>'MOON / '+date,modeFree:seed=>'FREE / '+seed,
    shareLine:'ONE MORE HOP!'
  }),
  ja: Object.freeze({
    tagline:'あと1回、跳ぼう！', hops:'HOPS', best:'BEST', daily:'デイリー', free:'フリー',
    introMark:'✦ 月面通信局 ✦',
    startTitle:'さあ、跳ぼう！', startText:'自動でジャンプ。速さはあなた次第。', startButton:'スタート',
    pauseTitle:'ひと休み。', pauseText:'ゆっくりの速さで再開します。', pauseButton:'再開',
    recordTitle:'自己ベスト更新！', resultTitle:'もう1回跳ぶ？', retryButton:'もう一度',
    short:'届かなかった · 少し長く押そう', far:'跳びすぎた · 少し早く離そう',
    hold:'押し続ける', release:'離す', toFast:'押すと速くなる', toSlow:'離すとゆっくり',
    soundOn:'音あり', soundOff:'消音',
    share:'Xに投稿 ↗', save:'画像を保存 ↓', attach:'保存画像はXで添付してね。',
    footer:'小さなポッド、果てしない月面。', keys:'SPACE = 押す · R = やり直し',
    switchLanguage:'Switch to English', parts:'青PODの部品', crew:'青PODと一緒',
    labels:{antenna:'アンテナ',body:'ボディ',engine:'動力部'},
    milestone:n=>n+' HOPS 達成 ♪', record:'自己ベスト更新！ ✦',
    earth:{'FAR SIDE':'月の裏側','EARTHGLOW':'地球の光','FULL EARTH':'地球が見えた！'},
    scoreDaily:date=>'今日の月 / '+date,scoreFree:seed=>'フリー / '+seed,
    modeDaily:date=>'月 / '+date,modeFree:seed=>'フリー / '+seed,
    shareLine:'あと1回、跳ぼう！'
  }),
});
export function copy(lang,key) { return TEXT[lang]?.[key] ?? TEXT.en[key]; }
export function earthText(lang,label) {
  if(label.startsWith('EARTHRISE ')) return lang==='ja'?'地球が昇る '+label.slice(10):label;
  return copy(lang,'earth')[label] ?? label;
}
export function partsText(lang,collected,total) {
  if(collected.length===total) return copy(lang,'crew');
  const label=copy(lang,'parts'), names=collected.map(p=>copy(lang,'labels')[p]).join(' + ');
  return lang==='ja'?label+' '+collected.length+'/'+total+' · '+names:label+' '+collected.length+'/'+total+' · '+names;
}
export function milestoneText(lang,hops) {
  return copy(lang,'milestone')(hops);
}
