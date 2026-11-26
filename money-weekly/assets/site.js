/* 이번 주 돈되는 정보 — 공통 동작 */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1) 스크롤 등장 (IntersectionObserver)
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      if (e.target.hasAttribute('data-count')) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }) : null;
  document.querySelectorAll('.reveal, [data-count]').forEach(function (el) {
    if (io) io.observe(el); else { el.classList.add('in'); if (el.hasAttribute('data-count')) countUp(el); }
  });

  // 2) 헤드라인 단어별 등장
  document.querySelectorAll('[data-words]').forEach(function (el) {
    var html = el.innerHTML.split(/(<br\s*\/?>)/i).map(function (part) {
      if (/^<br/i.test(part)) return part;
      return part.split(/(<[^>]+>[^<]*<\/[^>]+>|\s+)/).map(function (tok) {
        if (!tok) return '';
        if (/^\s+$/.test(tok)) return ' ';
        return '<span class="w">' + tok + '</span>';
      }).join('');
    }).join('');
    el.innerHTML = html;
    el.classList.add('words');
    el.querySelectorAll('.w').forEach(function (w, i) { w.style.setProperty('--i', i); });
  });

  // 3) 숫자 올라가기
  function countUp(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var dec = (el.getAttribute('data-count').split('.')[1] || '').length;
    var comma = el.hasAttribute('data-comma');
    if (reduce) { el.textContent = fmt(target); return; }
    var t0 = null, dur = 1400;
    function fmt(v) { var s = v.toFixed(dec); return comma ? Number(s).toLocaleString('ko-KR') : s; }
    function tick(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 4);
      el.textContent = fmt(target * e);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // 4) 자석 버튼 (마우스가 있는 기기만)
  if (!reduce && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.btn').forEach(function (b) {
      b.addEventListener('pointermove', function (ev) {
        var r = b.getBoundingClientRect();
        var x = (ev.clientX - r.left - r.width / 2) * 0.12, y = (ev.clientY - r.top - r.height / 2) * 0.2;
        b.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(1.02)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  // 5) 하단 고정 바: 첫 화면을 지나면 등장
  var dock = document.querySelector('.dock'), sentinel = document.querySelector('[data-dock-after]');
  if (dock && sentinel && io) {
    // 표시 기준점이 화면 위로 지나갔을 때만 보인다 (첫 화면에서는 숨김)
    new IntersectionObserver(function (es) {
      var e = es[0]; dock.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(sentinel);
  }

  // 6) 보낸 사람 표시 (?from=이름) — 링크를 보낸 설계사 이름
  try {
    var from = new URLSearchParams(location.search).get('from');
    if (from) {
      from = from.trim().slice(0, 12);
      document.querySelectorAll('.sender').forEach(function (s) {
        s.querySelector('[data-from]').textContent = from;
        s.querySelector('.av').textContent = from.charAt(0);
        s.classList.add('on');
      });
      // 내부 링크에도 이름을 이어 붙인다
      document.querySelectorAll('a[data-keep-from]').forEach(function (a) {
        var u = new URL(a.getAttribute('href'), location.href); u.searchParams.set('from', from); a.setAttribute('href', u.href);
      });
    }
  } catch (e) { /* 오래된 브라우저는 무시 */ }

  // 6-1) 방문 통계 이벤트 (GoatCounter, 쿠키 없음) — 데이터맨이 읽는다
  var page = (location.pathname.split('/').pop() || 'home').replace(/\.html$/, '');
  function track(name, title) {
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: name + '@' + page, title: title || name, event: true }); } catch (e) { /* 통계 실패는 무시 */ }
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-ask],[data-share],[data-event]');
    if (!el) return;
    if (el.hasAttribute('data-ask')) track('ask', el.textContent.trim());
    else if (el.hasAttribute('data-share')) track('share', '공유 버튼');
    else track(el.getAttribute('data-event'), el.textContent.trim());
  });
  window.__mwTrack = track;

  // 7) 공유하기 (카톡 공유 시트 / 링크 복사)
  var toast = document.querySelector('.toast');
  function say(msg) { if (!toast) return; toast.textContent = msg; toast.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(function () { toast.classList.remove('on'); }, 2200); }
  function copyText(text, okMsg) {
    var fallback = function () { prompt('아래 내용을 길게 눌러 복사하세요', text); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { say(okMsg); }, fallback);
    else fallback();
  }
  document.querySelectorAll('[data-share]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var data = { title: document.title, text: (document.querySelector('meta[name=description]') || {}).content || '', url: location.href };
      var copyLink = function () { copyText(location.href, '링크를 복사했어요. 카톡 대화창에 붙여넣어 보세요'); };
      if (navigator.share) {
        navigator.share(data).catch(function (err) { if (!err || err.name !== 'AbortError') copyLink(); });
      } else copyLink();
    });
  });
  // 도움 요청 문구 복사 (고객 → 보낸 사람에게 답장)
  document.querySelectorAll('[data-ask]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      copyText(btn.getAttribute('data-ask'), '문구를 복사했어요. 이 링크를 받은 카톡방에 붙여넣어 보내 주세요');
    });
  });

  // 8) 보관함 필터
  var filters = document.querySelectorAll('.filters button');
  filters.forEach(function (f) {
    f.addEventListener('click', function () {
      filters.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      f.setAttribute('aria-pressed', 'true');
      var cat = f.getAttribute('data-cat'), shown = 0;
      document.querySelectorAll('.list .item').forEach(function (it) {
        var ok = cat === 'all' || (it.getAttribute('data-cat') || '').split(' ').indexOf(cat) > -1;
        it.style.display = ok ? '' : 'none'; if (ok) shown++;
      });
      var empty = document.querySelector('.empty'); if (empty) empty.style.display = shown ? 'none' : 'block';
    });
  });
  document.querySelectorAll('[data-filter-link]').forEach(function (a) {
    a.addEventListener('click', function () {
      var b = document.querySelector('.filters button[data-cat="' + a.getAttribute('data-filter-link') + '"]');
      if (b) setTimeout(function () { b.click(); }, 350);
    });
  });

  // 9) 카드뉴스 넘기기
  var deck = document.querySelector('.deck');
  if (deck) {
    var slides = deck.querySelectorAll('.slide'), fill = document.querySelector('.deck-bar .fill'), count = document.querySelector('.deck-bar .count');
    var cur = 0;
    var finished = false;
    function mark(i) {
      cur = i;
      if (i === slides.length - 1 && !finished) { finished = true; track('cards-finished', '카드뉴스 끝까지 봄'); }
      slides.forEach(function (s, k) { s.classList.toggle('on', k === i); });
      if (fill) fill.style.transform = 'scaleX(' + ((i + 1) / slides.length) + ')';
      if (count) count.textContent = (i + 1) + ' / ' + slides.length;
    }
    if ('IntersectionObserver' in window) {
      var sio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting && e.intersectionRatio > 0.6) mark([].indexOf.call(slides, e.target)); });
      }, { root: deck, threshold: [0.6] });
      slides.forEach(function (s) { sio.observe(s); });
    } else {
      deck.addEventListener('scroll', function () {   // 오래된 브라우저 대체 처리
        var w = slides[0].getBoundingClientRect().width + 16;
        mark(Math.max(0, Math.min(slides.length - 1, Math.round(deck.scrollLeft / w))));
      }, { passive: true });
    }
    function go(i) { i = Math.max(0, Math.min(slides.length - 1, i)); slides[i].scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'center' }); }
    var prev = document.querySelector('[data-deck=prev]'), next = document.querySelector('[data-deck=next]');
    if (prev) prev.addEventListener('click', function () { go(cur - 1); });
    if (next) next.addEventListener('click', function () { go(cur + 1); });
    deck.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); });
    mark(0);
  }

  // 10) 확대 보기
  var lb = document.querySelector('.lightbox');
  if (lb) {
    var lbImg = lb.querySelector('img'), lbClose = lb.querySelector('button'), opener = null;
    lb.hidden = true;
    function open(el) {
      var img = el.querySelector('img') || el; opener = el;
      lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt;
      lb.classList.toggle('tall', img.naturalHeight > img.naturalWidth * 1.3);
      lb.hidden = false; requestAnimationFrame(function () { lb.classList.add('on'); lbClose.focus(); });
      document.body.style.overflow = 'hidden';
    }
    function close() {
      if (lb.hidden) return;
      lb.classList.remove('on'); document.body.style.overflow = '';
      setTimeout(function () { lb.hidden = true; }, 300);
      if (opener) opener.focus();
    }
    document.querySelectorAll('[data-zoom]').forEach(function (el) {
      if (!/^(BUTTON|A)$/.test(el.tagName)) { el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); }
      el.addEventListener('click', function () { open(el); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(el); } });
    });
    lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('button')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); if (e.key === 'Tab' && !lb.hidden) { e.preventDefault(); lbClose.focus(); } });
  }

  // 10-1) 자가진단: [data-quiz] 안의 .q 단계별 질문 → .res[data-res] 결과
  document.querySelectorAll('[data-quiz]').forEach(function (qz) {
    var qs = qz.querySelectorAll('.q'), bars = qz.querySelectorAll('.steps-bar i'), ans = {};
    function show(i) {
      qs.forEach(function (q, k) { q.classList.toggle('on', k === i); });
      bars.forEach(function (b, k) { b.classList.toggle('on', k <= i); });
    }
    function decide() {
      // 페이지마다 판정 규칙이 다르면 window.quizDecide(ans) 를 먼저 정의해 둔다
      if (typeof window.quizDecide === 'function') return window.quizDecide(ans);
      var g = ans.when, use = ans.use;
      if (g === 'after') return 'no';
      if (g === 'unknown') return 'unknown';
      return use === 'often' ? 'maybe' : 'high';
    }
    qz.querySelectorAll('.q').forEach(function (q, i) {
      q.querySelectorAll('button[data-v]').forEach(function (b) {
        b.addEventListener('click', function () {
          ans[q.getAttribute('data-key')] = b.getAttribute('data-v');
          if (i < qs.length - 1) { show(i + 1); return; }
          qs.forEach(function (x) { x.classList.remove('on'); });
          bars.forEach(function (x) { x.classList.add('on'); });
          var r = decide();
          qz.querySelectorAll('.res').forEach(function (x) { x.classList.toggle('on', x.getAttribute('data-res') === r); });
          track('quiz-' + r, '자가진단 결과');
        });
      });
    });
    var again = qz.querySelectorAll('[data-again]');
    again.forEach(function (a) { a.addEventListener('click', function () { ans = {}; qz.querySelectorAll('.res').forEach(function (x) { x.classList.remove('on'); }); show(0); }); });
    show(0);
  });

  // 10-2) 마감 카운트다운: [data-deadline="YYYY-MM-DD"]
  document.querySelectorAll('[data-deadline]').forEach(function (el) {
    // 한국 날짜 기준 달력 일수 (마감 당일은 D-DAY, 다음 날부터 '마감')
    var dayMs = 86400000, kst = 9 * 3600000;
    var end = Date.parse(el.getAttribute('data-deadline') + 'T00:00:00Z');
    var today = Math.floor((Date.now() + kst) / dayMs) * dayMs;
    var days = Math.round((end - today) / dayMs);
    el.textContent = days > 0 ? 'D-' + days : (days === 0 ? 'D-DAY' : '마감');
  });

  // 11) ISA 절세 계산기 (단순 예시)
  var range = document.getElementById('profit');
  if (range) {
    var won = function (v) { return Math.round(v).toLocaleString('ko-KR'); };
    var out = {
      amt: document.getElementById('amt'), gen: document.getElementById('t-gen'), isa: document.getElementById('t-isa'), low: document.getElementById('t-low'),
      fgen: document.querySelector('.bar.gen .fill'), fisa: document.querySelector('.bar.isa .fill'), flow: document.querySelector('.bar.low .fill'), save: document.getElementById('save')
    };
    function calc() {
      var p = Number(range.value) * 10000; // 만 원 단위
      var gen = p * 0.154, isa = Math.max(0, p - 2000000) * 0.099, low = Math.max(0, p - 4000000) * 0.099;
      out.amt.textContent = Number(range.value).toLocaleString('ko-KR');
      out.gen.textContent = won(gen) + '원'; out.isa.textContent = won(isa) + '원'; out.low.textContent = won(low) + '원';
      var max = Math.max(gen, 1);
      out.fgen.style.transform = 'scaleX(' + (gen / max) + ')';
      out.fisa.style.transform = 'scaleX(' + (isa / max) + ')';
      out.flow.style.transform = 'scaleX(' + (low / max) + ')';
      out.save.textContent = won(gen - isa) + '원';
      range.style.setProperty('--p', ((range.value - range.min) / (range.max - range.min) * 100) + '%');
    }
    range.addEventListener('input', calc); calc();
  }
})();
