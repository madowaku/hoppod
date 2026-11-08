// The stage select. Links only: no game code loads until a stage is chosen, and every
// address is relative, so it also works inside an itch.io ZIP.
import { chooseLanguage, withLanguage } from './ui-copy.mjs';

const TEXT = Object.freeze({
  en: Object.freeze({
    tagline: 'One button. One beat. Where will you hop?', first: 'START HERE', switchTo: '日本語', switchLabel: 'Switch to Japanese',
    story: ['ACROSS THE MOON', 'Rescue your friends and come home.'],
    workshop: ['THE STARLIGHT WORKSHOP', 'Wake the instruments. Your hops become the song.'],
    tower: ['THE SUNWISE CLOCK TOWER', 'Clockwork rooms, one mechanism each. Bring the morning.'],
    free: ['FREE RUN', 'An endless moon. Hop as far as you can.'],
  }),
  ja: Object.freeze({
    tagline: 'ボタンひとつ、拍ひとつ。どこを跳ぶ？', first: 'はじめはここから', switchTo: 'EN', switchLabel: 'Switch to English',
    story: ['月渡りのラピッポ', '仲間を助けて、いっしょに帰ろう。'],
    workshop: ['星明りの楽器工房', '楽器を起こそう。あなたの跳ねた跡が曲になる。'],
    tower: ['陽周りの時計台', '仕掛けだらけの塔をのぼって、朝を連れてこよう。'],
    free: ['フリーラン', '終わりのない月面を、どこまでも。'],
  }),
});
const PAGES = Object.freeze({ story: 'story.html', workshop: 'workshop.html', tower: 'clocktower.html', free: 'index.html?mode=free' });
const read = () => { try { return localStorage.getItem('hoppod.pref.lang'); } catch { return null; } };
const write = value => { try { localStorage.setItem('hoppod.pref.lang', value); } catch { /* this visit only */ } };
const $ = id => document.getElementById(id);
let language = chooseLanguage(location.href, read());

function refresh() {
  const text = TEXT[language];
  document.documentElement.lang = language;
  $('tagline').textContent = text.tagline; $('first').textContent = text.first;
  $('language').textContent = text.switchTo; $('language').setAttribute('aria-label', text.switchLabel);
  for (const [id, page] of Object.entries(PAGES)) {
    const link = $(id);
    link.querySelector('strong').textContent = text[id][0];
    link.querySelector('small').textContent = text[id][1];
    link.setAttribute('href', page + (page.includes('?') ? '&' : '?') + 'lang=' + language);
  }
}
$('language').addEventListener('click', () => {
  language = language === 'ja' ? 'en' : 'ja'; write(language);
  history.replaceState(history.state, '', withLanguage(location.href, language)); refresh();
});
refresh();
