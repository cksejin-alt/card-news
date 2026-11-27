/* 간병인보험 제안서 — 링크 값(컨설턴트·고객·나이·보험료)으로 내용 바꾸기
 * 링크 형식: ?c=컨설턴트&to=고객&age=나이&a=지원일당보험료&a20=20년뒤예상보험료&b=사용일당보험료
 * a만 있으면 지원일당 모드, b만 있으면 사용일당 모드, 둘 다 있으면 비교(지원일당 추천) 모드
 */
(() => {
  'use strict';

  const LEGACY = { a: 74508, aLater: 150000, b: 101350 }; // 첫 제안서(박재철 고객님) 값
  const DEFAULT_YEARS = 20; // 기간을 안 넣은 링크(첫 제안서)는 지원일당 20년 갱신, 사용일당 20년납 100세만기
  const won = (n) => Math.round(n).toLocaleString('ko-KR');
  const clean = (s, max) => (s || '').replace(/[<>"'&]/g, '').trim().slice(0, max);
  const money = (s) => {
    const n = Number(String(s || '').replace(/[^\d]/g, ''));
    return Number.isFinite(n) && n > 0 && n < 100000000 ? n : 0;
  };
  const manwon = (n) => (n % 10000 === 0 ? `${n / 10000}만원` : `${won(n)}원`);

  function pathMode() {
    const p = location.pathname;
    if (/\/a\/(index\.html)?$/.test(p)) return 'a';
    if (/\/b\/(index\.html)?$/.test(p)) return 'b';
    return 'both';
  }

  function readConfig() {
    const q = new URLSearchParams(location.search);
    let a = money(q.get('a'));
    let b = money(q.get('b'));
    let aLater = money(q.get('a20'));
    if (!a && !b) {
      const pm = pathMode();
      if (pm !== 'b') { a = LEGACY.a; aLater = LEGACY.aLater; }
      if (pm !== 'a') b = LEGACY.b;
    }
    const ageNum = Number(q.get('age'));
    const age = Number.isInteger(ageNum) && ageNum > 0 && ageNum < 120 ? ageNum : 0;
    const rawName = clean(q.get('to'), 12);
    // 기간: 지원일당 갱신 주기(ar), 사용일당 형태(bt: r=갱신형, m=세만기) · 기간(bp) · 만기 나이(bm)
    const years = (s, def, min, max) => {
      const n = Number(s);
      return Number.isInteger(n) && n >= min && n <= max ? n : def;
    };
    const bType = q.get('bt') === 'r' ? 'r' : 'm';
    return {
      consultant: clean(q.get('c'), 12),
      name: rawName ? (/님$/.test(rawName) ? rawName : `${rawName} 고객님`) : '고객님',
      hasName: Boolean(rawName),
      age,
      a, b, aLater: a ? aLater : 0,
      aRenew: years(q.get('ar'), DEFAULT_YEARS, 1, 100),
      bType,
      bYears: years(q.get('bp'), DEFAULT_YEARS, 1, 100),
      bMature: years(q.get('bm'), 100, 50, 120),
      mode: a && b ? 'both' : (a ? 'a' : 'b'),
    };
  }

  function values(cfg) {
    const aMonths = cfg.aRenew * 12;
    const bMonths = cfg.bYears * 12;
    const cmpYears = Math.min(cfg.aRenew, cfg.bYears);
    const bTerm = cfg.bType === 'r' ? `${cfg.bYears}년 갱신형` : `${cfg.bYears}년납 ${cfg.bMature}세만기`;
    const v = {
      consultant: cfg.consultant,
      name: cfg.name,
      age: cfg.age ? `${cfg.age}세` : '',
      aAge: cfg.age ? `${cfg.age + cfg.aRenew}세` : '',
      a: won(cfg.a), b: won(cfg.b),
      aTotal: won(cfg.a * aMonths), bTotal: won(cfg.b * bMonths),
      aLater: cfg.aLater ? manwon(cfg.aLater) : '',
      aR: `${cfg.aRenew}년`, aNext: `${cfg.aRenew + 1}년째`, aMonths: `${aMonths}개월`,
      bP: `${cfg.bYears}년`, bNext: `${cfg.bYears + 1}년째`, bMonths: `${bMonths}개월`, bM: `${cfg.bMature}세`,
      bTerm, cmpY: `${cmpYears}년`,
    };
    const diff = cfg.b - cfg.a;
    v.diff = won(diff);
    v.diffP = won(diff * cmpYears * 12);
    return { text: v, counts: { a: cfg.a, b: cfg.b, aTotal: cfg.a * aMonths, bTotal: cfg.b * bMonths, diff } };
  }

  function apply(cfg) {
    const root = document.documentElement;
    root.dataset.mode = cfg.mode;
    root.classList.toggle('no-alater', !cfg.aLater);
    root.classList.toggle('a-not-cheaper', !(cfg.a && cfg.b && cfg.a < cfg.b));
    root.classList.toggle('no-consultant', !cfg.consultant);
    root.classList.toggle('no-age', !cfg.age);
    root.classList.toggle('b-renew', cfg.bType === 'r');

    const { text, counts } = values(cfg);
    document.querySelectorAll('[data-v]').forEach((el) => { el.textContent = text[el.dataset.v] ?? ''; });
    document.querySelectorAll('[data-count-key]').forEach((el) => {
      const n = counts[el.dataset.countKey] || 0;
      el.dataset.count = String(n);
      el.textContent = won(n);
    });
    document.querySelectorAll('.js-name').forEach((el) => { el.textContent = cfg.name; });

    // 1안·2안 표시는 비교 모드에서만, 한 가지만 볼 때는 상품 이름으로
    if (cfg.mode !== 'both') {
      document.querySelectorAll('.qa__tag.tag-a').forEach((el) => { el.textContent = '지원일당'; });
      document.querySelectorAll('.qa__tag.tag-b').forEach((el) => { el.textContent = '사용일당'; });
    }

    // 지원일당 갱신 막대: 지금 보험료 / 20년 뒤 예상
    const renew = document.querySelector('.renew__fill');
    if (renew && cfg.aLater) renew.dataset.grow = Math.min(1, cfg.a / cfg.aLater).toFixed(3);

    buildMarquee(cfg.mode, text);
    buildCopyTexts(cfg);

    const who = cfg.hasName ? cfg.name : '';
    document.title = `${who ? `${who} · ` : ''}간병인보험 제안서`;
    window.CARE_CFG = cfg;
  }

  const MARQUEE = {
    a: (t) => ['상해 · 질병 모두', '일반병원 · 요양병원', '1~180일 · 181일 이상', '본인부담금 없음', '간병인 직접 지원', '오른 간병비도 회사가 부담', `${t.aR} 갱신형`],
    b: (t) => ['일반병원 하루 15만원', '요양병원 하루 5만원', '20년 뒤 일당 2배', t.bTerm, '원하는 간병인 직접 선택'],
    both: (t) => ['상해 · 질병 모두', '일반병원 · 요양병원', '1~180일 · 181일 이상', '본인부담금 없음', '20년 뒤 체증 2배', t.bTerm],
  };
  function buildMarquee(mode, text) {
    const track = document.querySelector('.marquee__track');
    if (!track) return;
    const items = MARQUEE[mode](text);
    track.textContent = '';
    for (let round = 0; round < 2; round += 1) {
      items.forEach((label) => {
        const s = document.createElement('span');
        s.textContent = label;
        const i = document.createElement('i');
        i.textContent = '✦';
        track.append(s, i);
      });
    }
  }

  function buildCopyTexts(cfg) {
    const to = cfg.consultant ? `${cfg.consultant} 컨설턴트님, ` : '';
    const msgs = {
      a: cfg.mode === 'both' ? '1안(간병인 지원일당) 조금 더 자세히 알고 싶어요.' : '간병인 지원일당 조금 더 자세히 알고 싶어요.',
      b: cfg.mode === 'both' ? '2안(간병인 사용일당 체증형) 조금 더 자세히 알고 싶어요.' : '간병인 사용일당 조금 더 자세히 알고 싶어요.',
      both: '간병인보험 1안, 2안 비교해서 설명 부탁드려요.',
    };
    document.querySelectorAll('[data-copy-key]').forEach((btn) => {
      btn.dataset.copy = to + msgs[btn.dataset.copyKey];
    });
  }

  apply(readConfig());
})();
