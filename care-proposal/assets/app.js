/* 간병인보험 제안서 — 인터랙션 */
(() => {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE_POINTER = window.matchMedia('(pointer: fine)').matches;
  const won = (n) => Math.round(n).toLocaleString('ko-KR');

  /* ---------- 받는 분 이름 (?to=이름) ---------- */
  function applyName() {
    const raw = new URLSearchParams(location.search).get('to');
    if (!raw) return;
    const name = raw.replace(/[<>"'&]/g, '').trim().slice(0, 12);
    if (!name) return;
    const label = /님$/.test(name) ? name : `${name} 고객님`;
    document.querySelectorAll('.js-name').forEach((el) => { el.textContent = label; });
    document.title = `${label} · 간병인보험 제안서`;
  }

  /* ---------- 제목 단어 분할 ---------- */
  function splitWords(root) {
    let idx = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = child.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('span');
            inner.textContent = part;
            inner.style.setProperty('--wi', idx++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(root);
  }

  /* ---------- 숫자 카운트업 ---------- */
  function countUp(el) {
    const target = Number(el.dataset.count);
    if (!target || REDUCED) { el.textContent = won(target); return; }
    const dur = 1600;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 4);
      el.textContent = won(target * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    el.textContent = '0';
    requestAnimationFrame(tick);
  }

  /* ---------- 화면 진입 감지 ---------- */
  function observeReveals(onChart) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-in');
        el.querySelectorAll('[data-count]').forEach(countUp);
        if (el.matches('[data-count]')) countUp(el);
        el.querySelectorAll('[data-grow]').forEach((bar) => {
          bar.style.transform = `scaleX(${bar.dataset.grow})`;
        });
        if (el.id === 'chart' || el.querySelector('#chart')) onChart();
        io.unobserve(el);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });

    document.querySelectorAll('[data-reveal], [data-split], .steps__list, .tiles .tile').forEach((el) => io.observe(el));
  }

  /* ---------- 인트로 ---------- */
  function runIntro(done) {
    const intro = document.getElementById('intro');
    if (!intro) { done(); return; }
    const finish = () => {
      if (intro.classList.contains('is-out')) return;
      intro.classList.add('is-out');
      document.body.classList.remove('is-locked');
      setTimeout(done, 250);
      setTimeout(() => intro.remove(), 1500);
    };
    if (REDUCED) { intro.remove(); done(); return; }
    document.body.classList.add('is-locked');
    intro.addEventListener('click', finish, { once: true });
    setTimeout(finish, 2300);
  }

  /* ---------- 부드러운 스크롤 + 진행바 + 패럴랙스 + 독 ---------- */
  function initScroll() {
    const bar = document.getElementById('progressBar');
    const dock = document.getElementById('dock');
    const parallax = [...document.querySelectorAll('[data-parallax]')];
    const hero = document.getElementById('hero');

    const onScroll = (y) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      if (dock && hero) dock.classList.toggle('is-on', y > hero.offsetHeight * 0.6);
      if (REDUCED) return;
      parallax.forEach((el) => {
        const rect = el.parentElement.getBoundingClientRect();
        const offset = (rect.top + rect.height / 2 - innerHeight / 2) * Number(el.dataset.parallax);
        const base = el.classList.contains('hero__frame') ? ' rotate(1.2deg)' : '';
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)${base}`;
      });
    };

    let lenis = null;
    if (window.Lenis && !REDUCED) {
      lenis = new window.Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
      lenis.on('scroll', ({ scroll }) => onScroll(scroll));
      const raf = (time) => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    } else {
      let ticking = false;
      document.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { onScroll(scrollY); ticking = false; });
      }, { passive: true });
    }
    onScroll(scrollY);

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(target, { offset: -10 });
        else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      });
    });

    // 현재 섹션 표시
    const links = new Map([...document.querySelectorAll('[data-dock]')].map((a) => [a.dataset.dock, a]));
    const secIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.remove('is-active'));
        const hit = links.get(entry.target.id);
        if (hit && !hit.classList.contains('dock__ask')) hit.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((_, id) => { const s = document.getElementById(id); if (s) secIO.observe(s); });
  }

  /* ---------- 마그네틱 버튼 · 카드 기울기 ---------- */
  function initPointerFx() {
    if (!FINE_POINTER || REDUCED) return;
    document.querySelectorAll('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.18;
        const y = (e.clientY - r.top - r.height / 2) * 0.28;
        el.style.transform = `translate(${x}px, ${y}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
    document.querySelectorAll('[data-tilt]').forEach((el) => {
      const base = getComputedStyle(el).transform;
      const baseT = base === 'none' ? '' : base;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 6;
        el.style.transform = `${baseT} perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- 계산기 ---------- */
  const DAILY = { general: { now: 150000, later: 300000 }, care: { now: 50000, later: 100000 } };
  function initCalc() {
    const range = document.getElementById('days');
    if (!range) return;
    const state = { hosp: 'care', when: 'now' };
    const out = {
      day: document.getElementById('dayOut'), total: document.getElementById('bOut'), daily: document.getElementById('bDaily'),
      days: document.getElementById('bDays'), where: document.getElementById('aWhere'), warn: document.getElementById('bWarn'),
    };
    const render = () => {
      const days = Number(range.value);
      const daily = DAILY[state.hosp][state.when];
      range.style.setProperty('--p', `${((days - range.min) / (range.max - range.min)) * 100}%`);
      out.day.textContent = days;
      out.days.textContent = days;
      out.daily.textContent = `${daily / 10000}만원`;
      out.total.textContent = won(daily * days);
      out.where.textContent = state.hosp === 'care' ? '요양병원' : '일반병원';
      out.warn.hidden = state.hosp !== 'care';
      out.warn.textContent = state.when === 'now'
        ? '실제 간병비가 일당보다 많으면 차액은 직접 부담하셔야 해요.'
        : '그사이 간병비가 오르면 여전히 부족하게 느끼실 수 있어요.';
      const card = out.total.closest('.result__card');
      card.classList.remove('bump'); void card.offsetWidth; card.classList.add('bump');
    };
    range.addEventListener('input', render);
    document.querySelectorAll('.seg button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.hosp ? 'hosp' : 'when';
        state[key] = btn.dataset[key];
        btn.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b === btn));
        render();
      });
    });
    render();
  }

  /* ---------- 보험료 흐름 차트 ---------- */
  const PLAN_A = { early: 74508, late: 150000 };
  const PLAN_B = { early: 101350, late: 0 };
  const YEARS = 30;
  const SWITCH = 20;
  const premiumAt = (plan, year) => (year <= SWITCH ? plan.early : plan.late);

  function buildChart() {
    const box = document.getElementById('chart');
    if (!box || box.dataset.built) return;
    box.dataset.built = '1';
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, parent) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
      if (parent) parent.appendChild(n);
      return n;
    };
    const tip = document.createElement('div');
    tip.className = 'tip';
    box.appendChild(tip);

    let svg = null;
    const draw = (animate) => {
      if (svg) svg.remove();
      const W = box.clientWidth;
      const H = box.clientHeight;
      const narrow = W < 520;
      const m = { t: 24, r: narrow ? 14 : 120, b: 34, l: narrow ? 40 : 56 };
      const iw = W - m.l - m.r;
      const ih = H - m.t - m.b;
      const yMax = 160000;
      const x = (yr) => m.l + (yr / YEARS) * iw;
      const y = (v) => m.t + ih - (v / yMax) * ih;

      svg = el('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
      box.insertBefore(svg, tip);

      el('rect', { class: 'zone', x: x(SWITCH), y: m.t, width: x(YEARS) - x(SWITCH), height: ih, rx: 8 }, svg);
      const zl = el('text', { class: 'dlabel dlabel--sub', x: x(SWITCH) + 8, y: y(PLAN_A.late) + (narrow ? 34 : 40) }, svg);
      zl.textContent = narrow ? '갱신 예상' : '21년째~ 갱신 예상';

      const grid = el('g', { class: 'grid' }, svg);
      const axis = el('g', { class: 'axis' }, svg);
      [0, 50000, 100000, 150000].forEach((v) => {
        el('line', { x1: m.l, x2: m.l + iw, y1: y(v), y2: y(v) }, grid);
        const t = el('text', { x: m.l - 10, y: y(v) + 4, 'text-anchor': 'end' }, axis);
        t.textContent = v === 0 ? '0' : `${v / 10000}만`;
      });
      [1, 5, 10, 15, 20, 25, 30].forEach((yr) => {
        const t = el('text', { x: x(yr), y: H - 10, 'text-anchor': 'middle' }, axis);
        t.textContent = `${yr}년`;
      });

      const clipId = 'chartClip';
      const defs = el('defs', {}, svg);
      const clip = el('clipPath', { id: clipId }, defs);
      const clipRect = el('rect', { x: 0, y: 0, width: animate && !REDUCED ? 0 : W, height: H }, clip);
      const lines = el('g', { 'clip-path': `url(#${clipId})` }, svg);

      // 1안: 20년 고정 → 갱신 예상(점선)
      el('path', { class: 'ln ln--a', d: `M${x(0)},${y(PLAN_A.early)} H${x(SWITCH)}` }, lines);
      el('path', { class: 'ln ln--a ln--dash', d: `M${x(SWITCH)},${y(PLAN_A.early)} V${y(PLAN_A.late)} H${x(YEARS)}` }, lines);
      // 2안: 20년 납입 → 0원
      el('path', { class: 'ln ln--b', d: `M${x(0)},${y(PLAN_B.early)} H${x(SWITCH)} V${y(PLAN_B.late)} H${x(YEARS)}` }, lines);

      if (!narrow) {
        const la = el('text', { class: 'dlabel', x: x(YEARS) + 10, y: y(PLAN_A.late) + 4 }, svg);
        la.textContent = '1안 약 15만원';
        const la2 = el('text', { class: 'dlabel dlabel--sub', x: x(YEARS) + 10, y: y(PLAN_A.late) + 20 }, svg);
        la2.textContent = '갱신 예상';
        const lb = el('text', { class: 'dlabel', x: x(YEARS) + 10, y: y(0) - 4 }, svg);
        lb.textContent = '2안 0원';
        const lb2 = el('text', { class: 'dlabel dlabel--sub', x: x(YEARS) + 10, y: y(0) + 12 }, svg);
        lb2.textContent = '납입 완료';
      }
      const s1 = el('text', { class: 'dlabel dlabel--sub', x: x(1), y: y(PLAN_B.early) - 10 }, svg);
      s1.textContent = '2안 101,350원';
      const s2 = el('text', { class: 'dlabel dlabel--sub', x: x(1), y: y(PLAN_A.early) + 20 }, svg);
      s2.textContent = '1안 74,508원';

      const cross = el('line', { class: 'cross', y1: m.t, y2: m.t + ih, x1: -10, x2: -10 }, svg);
      const dotA = el('circle', { class: 'dot', r: 6, fill: 'var(--amber-d)', cx: -20, cy: -20 }, svg);
      const dotB = el('circle', { class: 'dot', r: 6, fill: 'var(--blue)', cx: -20, cy: -20 }, svg);
      const hit = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, svg);

      const showAt = (clientX) => {
        const r = box.getBoundingClientRect();
        const yr = Math.min(YEARS, Math.max(1, Math.round(((clientX - r.left - m.l) / iw) * YEARS)));
        const a = premiumAt(PLAN_A, yr);
        const b = premiumAt(PLAN_B, yr);
        cross.setAttribute('x1', x(yr)); cross.setAttribute('x2', x(yr));
        dotA.setAttribute('cx', x(yr)); dotA.setAttribute('cy', y(a));
        dotB.setAttribute('cx', x(yr)); dotB.setAttribute('cy', y(b));
        tip.innerHTML = `<b>${yr}년차 월 보험료</b><br><i style="background:var(--amber-d)"></i>1안 ${won(a)}원${yr > SWITCH ? ' (예상)' : ''}<br><i style="background:var(--blue)"></i>2안 ${b ? `${won(b)}원` : '0원 · 납입 완료'}`;
        tip.style.left = `${Math.min(Math.max(x(yr), 90), W - 90)}px`;
        tip.style.top = `${Math.min(y(a), y(b)) - 6}px`;
        tip.classList.add('is-on');
      };
      const hide = () => {
        tip.classList.remove('is-on');
        cross.setAttribute('x1', -10); cross.setAttribute('x2', -10);
        dotA.setAttribute('cx', -20); dotB.setAttribute('cx', -20);
      };
      hit.addEventListener('pointermove', (e) => showAt(e.clientX));
      hit.addEventListener('pointerdown', (e) => showAt(e.clientX));
      hit.addEventListener('pointerleave', hide);

      if (animate && !REDUCED) {
        const start = performance.now();
        const dur = 1800;
        const step = (now) => {
          const t = Math.min(1, (now - start) / dur);
          clipRect.setAttribute('width', W * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    };

    draw(true);
    let lastW = box.clientWidth;
    new ResizeObserver(() => {
      if (Math.abs(box.clientWidth - lastW) < 4) return;
      lastW = box.clientWidth;
      draw(false);
    }).observe(box);
  }

  /* ---------- 문의 문구 복사 · PDF ---------- */
  function initAsk() {
    const toast = document.getElementById('toast');
    let timer = null;
    const say = (msg) => {
      toast.textContent = msg;
      toast.classList.add('is-on');
      clearTimeout(timer);
      timer = setTimeout(() => toast.classList.remove('is-on'), 2600);
    };
    const copy = async (text) => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (copyErr) { ok = false; }
        ta.remove();
        return ok;
      }
    };
    document.querySelectorAll('[data-copy]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await copy(btn.dataset.copy);
        say(ok ? '복사됐어요. 카톡 대화창에 붙여넣어 보내주세요' : '복사가 안 됐어요. 카톡으로 편하게 말씀 주세요');
      });
    });
    const pdf = document.getElementById('pdfBtn');
    if (pdf) {
      pdf.addEventListener('click', () => {
        document.querySelectorAll('[data-reveal], [data-split], .steps__list').forEach((el) => el.classList.add('is-in'));
        document.querySelectorAll('[data-grow]').forEach((b) => { b.style.transform = `scaleX(${b.dataset.grow})`; });
        buildChart();
        setTimeout(() => window.print(), 300);
      });
    }
  }

  /* ---------- 시작 ---------- */
  function init() {
    applyName();
    document.querySelectorAll('[data-split]').forEach(splitWords);
    initCalc();
    initAsk();
    initPointerFx();
    runIntro(() => {
      initScroll();
      observeReveals(buildChart);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
