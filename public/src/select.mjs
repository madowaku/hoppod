// The stage select. Links only: no game code loads until a stage is chosen, and every
// address is relative, so it also works inside an itch.io ZIP.
import { chooseLanguage, withLanguage } from './ui-copy.mjs';

const TEXT = Object.freeze({
  en: Object.freeze({
    tagline: 'One button. One beat. Where will you hop?', first: 'START HERE', switchTo: '日本語', switchLabel: 'Switch to Japanese',
    how: 'It hops by itself, on the beat. You choose how far.', slow: 'LET GO: near', fast: 'HOLD: far', done: 'CLEARED ✓', saved: 'CONTINUE',
    meta: { story: ['about 5 min', 'a story'], workshop: ['about 6 min', 'music'], tower: ['about 5 min', 'mechanisms'], free: ['endless', 'score attack'] },
    story: ['ACROSS THE MOON', 'Rescue your friends and come home.'],
    workshop: ['THE STARLIGHT WORKSHOP', 'Wake the instruments. Your hops become the song.'],
    tower: ['THE SUNWISE CLOCK TOWER', 'Clockwork rooms, one mechanism each. Bring the morning.'],
    free: ['FREE RUN', 'An endless moon. Hop as far as you can.'],
  }),
  ja: Object.freeze({
    tagline: 'ボタンひとつ、拍ひとつ。どこを跳ぶ？', first: 'はじめはここから', switchTo: 'EN', switchLabel: 'Switch to English',
    how: '拍にあわせて自動で跳ねます。決めるのは、どこまで跳ぶか。', slow: '離す：近くへ', fast: '押す：遠くへ', done: 'クリア ✓', saved: 'つづきから',
    meta: { story: ['約5分', 'ものがたり'], workshop: ['約6分', '音楽'], tower: ['約5分', 'からくり'], free: ['エンドレス', 'スコアアタック'] },
    story: ['月渡りのラピッポ', '仲間を助けて、いっしょに帰ろう。'],
    workshop: ['星明りの楽器工房', '楽器を起こそう。あなたの跳ねた跡が曲になる。'],
    tower: ['陽周りの時計台', '仕掛けだらけの塔をのぼって、朝を連れてこよう。'],
    free: ['フリーラン', '終わりのない月面を、どこまでも。'],
  }),
});
const PAGES = Object.freeze({ story: 'story.html', workshop: 'workshop.html', tower: 'clocktower.html', free: 'index.html?mode=free' });
const stored = key => { try { return localStorage.getItem(key); } catch { return null; } };
const read = () => stored('hoppod.pref.lang');
// How far this player has got in each stage, from what the stages save themselves.
const SAVES = Object.freeze({ story: 'hoppod.story.v1', workshop: 'hoppod.workshop.v1', tower: 'hoppod.tower.v1' });
function progress(id) {
  const key = SAVES[id]; if (!key) return null;
  let saved = false; try { saved = (JSON.parse(stored(key) || 'null')?.checkpoint || 0) > 0; } catch { /* an unreadable save is no save */ }
  return saved ? 'saved' : stored(key + '.cleared') === '1' ? 'done' : null;
}
const write = value => { try { localStorage.setItem('hoppod.pref.lang', value); } catch { /* this visit only */ } };
const $ = id => document.getElementById(id);
let language = chooseLanguage(location.href, read());

function refresh() {
  const text = TEXT[language];
  document.documentElement.lang = language;
  $('tagline').textContent = text.tagline; $('first').textContent = text.first;
  $('how-line').textContent = text.how; $('how-slow').textContent = text.slow; $('how-fast').textContent = text.fast;
  $('language').textContent = text.switchTo; $('language').setAttribute('aria-label', text.switchLabel);
  for (const [id, page] of Object.entries(PAGES)) {
    const link = $(id);
    link.querySelector('strong').textContent = text[id][0];
    link.querySelector('small').textContent = text[id][1];
    const meta = link.querySelector('.meta'), state = progress(id);
    meta.replaceChildren(...text.meta[id].map(label => Object.assign(document.createElement('u'), { textContent: label })));
    if (state) meta.append(Object.assign(document.createElement('u'), { textContent: text[state], className: state }));
    link.setAttribute('href', page + (page.includes('?') ? '&' : '?') + 'lang=' + language);
  }
}
$('language').addEventListener('click', () => {
  language = language === 'ja' ? 'en' : 'ja'; write(language);
  history.replaceState(history.state, '', withLanguage(location.href, language)); refresh();
});
refresh();
