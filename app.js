(function () {
  "use strict";
  var CFG = window.PASSUP_CONFIG || {};
  var app = document.getElementById("app");
  var DATA = null, BY_ID = {}, BY_GROUP = {}, TOPIC = {};
  var S = { screen: "home", session: null, topicArea: null, calcOpen: false, calcExpr: "" };
  var CIRC = ["①", "②", "③", "④"];
  var AREAS = ["재무회계", "원가회계", "부가가치세"];

  // ---------- 저장소(실패해도 동작) ----------
  function sget(store, k) { try { return JSON.parse(window[store].getItem(k)); } catch (e) { return null; } }
  function sset(store, k, v) { try { window[store].setItem(k, JSON.stringify(v)); } catch (e) {} }
  function sdel(store, k) { try { window[store].removeItem(k); } catch (e) {} }

  // ---------- 유틸 ----------
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function areaOf(q) { return TOPIC[q.t] ? TOPIC[q.t].area : ""; }
  function topicName(code) { return TOPIC[code] ? TOPIC[code].name : code; }
  function mmss(sec) { sec = Math.max(0, Math.floor(sec)); var m = Math.floor(sec / 60), s = sec % 60; return m + ":" + (s < 10 ? "0" : "") + s; }
  function today() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  // ---------- 입장 코드 ----------
  function checkAccess() {
    var code = String(CFG.accessCode || "");
    if (!code) return true;
    var params = new URLSearchParams(location.search);
    var given = params.get("code");
    if (given !== null) {
      params.delete("code");
      var rest = params.toString();
      try { history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash); } catch (e) {}
      if (given === code) { sset("localStorage", "passup.code", code); sset("sessionStorage", "passup.code", code); return true; }
    }
    return sget("localStorage", "passup.code") === code || sget("sessionStorage", "passup.code") === code;
  }
  function renderGate(errMsg) {
    app.innerHTML =
      '<div style="padding-top:12vh">' + logoHtml() +
      '<h1 style="margin-top:24px">입장 코드를 입력하세요</h1>' +
      '<p class="sub">공지방에서 받은 링크로 들어오면 코드 없이 바로 열려요.</p>' +
      '<input id="code" class="input" inputmode="numeric" autocomplete="off" maxlength="12" aria-label="입장 코드">' +
      (errMsg ? '<div class="err" role="alert">' + esc(errMsg) + "</div>" : "") +
      '<div style="margin-top:14px"><button class="btn primary" style="width:100%" id="go">입장</button></div></div>';
    var inp = document.getElementById("code");
    function go() {
      if (!inp.value.trim()) { renderGate("코드를 입력하세요."); return; }
      if (inp.value.trim() === String(CFG.accessCode)) { sset("localStorage", "passup.code", inp.value.trim()); sset("sessionStorage", "passup.code", inp.value.trim()); start(); }
      else renderGate("코드가 맞지 않아요. 공지방의 최신 코드를 확인하세요.");
    }
    document.getElementById("go").onclick = go;
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    inp.focus();
  }

  // ---------- 공통 조각 ----------
  function logoHtml() {
    return '<div class="logo">' + (CFG.logoUrl ? '<img src="' + esc(CFG.logoUrl) + '" alt="" onerror="this.remove()">' : "") + 'Pass<b>Up</b></div>';
  }
  function dday() {
    var t = today(), list = (CFG.exams || []).map(function (e) { var p = e.date.split("-"); return { round: e.round, d: new Date(+p[0], +p[1] - 1, +p[2]) }; })
      .filter(function (e) { return e.d >= t; }).sort(function (a, b) { return a.d - b.d; });
    if (!list.length) return { label: "공고 전", sub: "다음 시험 일정" };
    var n = Math.round((list[0].d - t) / 864e5);
    return { label: n === 0 ? "D-Day" : "D-" + n, sub: "제" + list[0].round + "회 · " + (list[0].d.getMonth() + 1) + "." + list[0].d.getDate() };
  }
  function bar(html) { return '<div class="bar"><div class="in">' + html + "</div></div>"; }
  function reportLink(q) {
    if (!CFG.reportFormUrl) return "";
    var url = CFG.reportFormUrl.replace("{id}", encodeURIComponent(q.id)).replace("{subject}", encodeURIComponent(DATA.subject));
    return '<a class="link" href="' + esc(url) + '" target="_blank" rel="noopener">이 문제 오류 신고</a>';
  }

  // ---------- 자료(표/텍스트) ----------
  function isNum(s) { return /^[\s\d,.\-+()%원개시간@×]+$/.test(s) && /\d/.test(s); }
  function dataHtml(x) {
    if (!x) return "";
    var lines = x.split("\n"), out = "", buf = [], tbl = [];
    function flushText() { if (buf.length) { out += '<div class="data">' + esc(buf.join("\n")) + "</div>"; buf = []; } }
    function flushTable() {
      if (!tbl.length) return;
      var rows = tbl.map(function (l) { return l.split("|").map(function (c) { return c.trim(); }); });
      var h = "<tr>" + rows[0].map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>";
      var b = rows.slice(1).map(function (r) { return "<tr>" + r.map(function (c) { return '<td class="' + (isNum(c) ? "num" : "") + '">' + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("");
      out += '<div class="tablewrap"><table>' + h + b + "</table></div>"; tbl = [];
    }
    lines.forEach(function (l) {
      if (l.indexOf("|") >= 0) { flushText(); tbl.push(l); } else { flushTable(); if (l.trim()) buf.push(l); }
    });
    flushTable(); flushText();
    return out;
  }

  // ---------- 세션 ----------
  function saveSession() { if (S.session) sset("sessionStorage", "passup.session", S.session); else sdel("sessionStorage", "passup.session"); }
  function newSession(mode, title, ids, extra) {
    S.session = { mode: mode, title: title, items: ids.map(function (id) { return { id: id, sel: 0, flag: false, checked: false }; }), idx: 0, elapsed: 0, submitted: false, used: ids.slice() };
    if (extra) for (var k in extra) S.session[k] = extra[k];
    saveSession();
    go("quiz");
  }
  function pickExam() {
    var spec = [["재무회계", 8], ["원가회계", 4], ["부가가치세", 3]], usedG = {}, order = DATA.topics.map(function (t) { return t.code; }), ids = [];
    var slots = []; spec.forEach(function (s) { for (var i = 0; i < s[1]; i++) slots.push(s[0]); });
    var simTarget = 2 + Math.floor(Math.random() * 2), simNeed = {};
    shuffle(slots).slice(0, simTarget).forEach(function (a) { simNeed[a] = (simNeed[a] || 0) + 1; });
    spec.forEach(function (s) {
      var got = [], wantSim = simNeed[s[0]] || 0;
      function take(level, count) {
        shuffle(DATA.questions.filter(function (q) { return areaOf(q) === s[0] && q.d === level; })).forEach(function (q) {
          if (count <= 0 || usedG[q.g]) return;
          got.push(q); usedG[q.g] = 1; count--;
        });
      }
      take("심화", wantSim);
      take("실전", s[1] - got.length);
      if (got.length < s[1]) take("심화", s[1] - got.length);
      got.sort(function (a, b) { return order.indexOf(a.t) - order.indexOf(b.t); });
      got.forEach(function (q) { ids.push(q.id); });
    });
    return ids;
  }
  function startExam() { newSession("exam", "실전 모의고사", pickExam()); }
  function startTopic(code) {
    var rank = { "기본": 0, "실전": 1, "심화": 2 };
    var qs = shuffle(DATA.questions.filter(function (q) { return q.t === code; })).sort(function (a, b) { return rank[a.d] - rank[b.d]; });
    newSession("practice", topicName(code), qs.map(function (q) { return q.id; }));
  }
  function startRandom() { newSession("practice", "랜덤 10문제", shuffle(DATA.questions).slice(0, 10).map(function (q) { return q.id; })); }
  function twinOf(id, used) {
    var q = BY_ID[id], group = BY_GROUP[q.g] || [];
    var fresh = shuffle(group.filter(function (x) { return x.id !== id && used.indexOf(x.id) < 0; }));
    if (fresh.length) return { q: fresh[0], fresh: true };
    var any = shuffle(group.filter(function (x) { return x.id !== id; }));
    return any.length ? { q: any[0], fresh: false } : null;
  }
  function startRetry(wrongIds) {
    var used = [], ids = [];
    wrongIds.forEach(function (id) { var t = twinOf(id, used.concat(wrongIds)); var nid = t ? t.q.id : id; ids.push(nid); used.push(nid); });
    newSession("practice", "틀린 개념 다시 풀기", ids);
  }

  // ---------- 화면 전환 ----------
  function go(screen, push) {
    S.screen = screen; S.calcOpen = false;
    if (push !== false) { try { history.pushState({ s: screen }, ""); } catch (e) {} }
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", function () {
    if (S.screen === "quiz" && S.session && !S.session.submitted && S.session.mode === "exam") {
      if (!confirm("모의고사를 그만둘까요? 홈에서 이어서 풀 수 있어요.")) { try { history.pushState({ s: "quiz" }, ""); } catch (e) {} return; }
    }
    if (S.screen === "review") { go("result", false); return; }
    go("home", false);
  });

  // ---------- 타이머(화면을 벗어나면 일시정지) ----------
  var tick = null, lastT = 0;
  function timerOn() {
    timerOff(); lastT = Date.now();
    tick = setInterval(function () {
      if (document.hidden || !S.session || S.session.submitted) { lastT = Date.now(); return; }
      var now = Date.now(); S.session.elapsed += (now - lastT) / 1000; lastT = now;
      var el = document.getElementById("timer"); if (el) el.textContent = mmss(S.session.elapsed);
      if (Math.floor(S.session.elapsed) % 5 === 0) saveSession();
    }, 1000);
  }
  function timerOff() { if (tick) clearInterval(tick); tick = null; }
  document.addEventListener("visibilitychange", function () { lastT = Date.now(); saveSession(); });

  // ---------- 렌더 ----------
  function render() {
    timerOff();
    if (S.screen === "home") renderHome();
    else if (S.screen === "topics") renderTopics();
    else if (S.screen === "quiz") renderQuiz();
    else if (S.screen === "result") renderResult();
    else if (S.screen === "review") renderReview();
  }

  function renderHome() {
    var d = dday(), last = sget("localStorage", "passup.last"), cur = S.session && !S.session.submitted ? S.session : null;
    var h = '<div class="top">' + logoHtml() + '<button class="iconbtn" id="fs" aria-label="글자 크기">가' + (document.documentElement.classList.contains("big") ? "-" : "+") + "</button></div>" +
      '<div class="sub" style="margin:-8px 0 12px">' + esc(DATA.subject) + " 이론</div>" +
      '<div class="card"><div class="sub">다음 시험</div><div class="big-num">' + esc(d.label) + '</div><div class="sub">' + esc(d.sub) + "</div></div>";
    if (cur) h += '<button class="card menu hero" id="resume"><div class="sub">풀던 문제가 있어요</div><div class="t">' + esc(cur.title) + " 이어서 풀기</div></button>";
    h += '<button class="card menu" id="m-exam"><div class="t">실전 모의고사</div><div class="sub">15문항 · 시험과 같은 번호 구성</div></button>' +
      '<button class="card menu" id="m-topic"><div class="t">주제별 연습</div><div class="sub">' + DATA.topics.length + "개 주제 중 골라서</div></button>" +
      '<button class="card menu" id="m-rand"><div class="t">랜덤 10문제</div><div class="sub">짧게 풀기</div></button>';
    if (last) h += '<p class="sub center" style="margin-top:16px">최근 결과 · ' + esc(last.title) + " " + last.correct + " / " + last.total + "</p>";
    h += '<p class="sub center" style="margin-top:24px;font-size:.78em">문제는 시험 경향을 바탕으로 새로 만든 변형 문항입니다.</p>';
    app.innerHTML = h;
    bind("fs", function () { var on = document.documentElement.classList.toggle("big"); sset("localStorage", "passup.big", on); renderHome(); });
    bind("resume", function () { go("quiz"); });
    bind("m-exam", function () { if (cur && cur.mode === "exam" && !confirm("풀던 모의고사가 있어요. 새로 시작할까요?")) return; startExam(); });
    bind("m-topic", function () { go("topics"); });
    bind("m-rand", startRandom);
  }

  function renderTopics() {
    var h = '<div class="top"><button class="iconbtn" id="back" aria-label="뒤로">‹ 홈</button><div></div></div><h1>주제별 연습</h1>';
    AREAS.forEach(function (a) {
      h += '<div class="area-title">' + a + '</div><div class="list">';
      DATA.topics.filter(function (t) { return t.area === a; }).forEach(function (t) {
        var n = DATA.questions.filter(function (q) { return q.t === t.code; }).length;
        h += '<button data-t="' + t.code + '"><span>' + esc(t.name) + '</span><span class="sub">' + n + "문항 ›</span></button>";
      });
      h += "</div>";
    });
    app.innerHTML = h;
    bind("back", function () { history.back(); });
    app.querySelectorAll("[data-t]").forEach(function (b) { b.onclick = function () { startTopic(b.getAttribute("data-t")); }; });
  }

  function choiceHtml(q, it, reveal) {
    return '<div class="choices">' + q.c.map(function (c, i) {
      var n = i + 1, cls = "choice", mark = "";
      if (reveal) {
        if (n === q.a) { cls += " right"; mark = '<span class="mark" aria-label="정답">✓</span>'; }
        else if (n === it.sel) { cls += " wrong"; mark = '<span class="mark" aria-label="내 답">✗</span>'; }
      } else if (n === it.sel) { cls += " sel"; mark = '<span class="mark">✓</span>'; }
      return '<button class="' + cls + '" data-c="' + n + '"' + (reveal ? " disabled" : "") + '><span class="n">' + CIRC[i] + "</span><span>" + esc(c) + "</span>" + mark + "</button>";
    }).join("") + "</div>";
  }
  function feedbackHtml(q, it, showTopic) {
    var ok = it.sel === q.a;
    var h = '<div style="margin-top:14px">' +
      (it.sel ? '<div class="result-banner ' + (ok ? "ok" : "bad") + '">' + (ok ? "✓ 정답이에요" : "✗ 정답은 " + CIRC[q.a - 1] + " · 내 답 " + CIRC[it.sel - 1]) + "</div>" :
        '<div class="result-banner bad">✗ 안 푼 문제 · 정답 ' + CIRC[q.a - 1] + "</div>");
    if (q.p) h += '<div class="trap"><b>⚠ 이 문제의 함정</b>' + esc(q.p) + "</div>";
    h += '<div class="exp">' + esc(q.e) + "</div>";
    h += '<div class="meta">' + (showTopic ? esc(topicName(q.t)) + " · " : "") + esc(q.id) + "</div>" + reportLink(q) + "</div>";
    return h;
  }
  function calcHtml() {
    if (!S.calcOpen) return "";
    var keys = ["C", "⌫", "(", ")", "7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", "00", ".", "+"];
    return '<div class="calc" role="dialog" aria-label="계산기"><div class="disp" id="cd">' + esc(S.calcExpr || "0") + '</div><div class="keys">' +
      keys.map(function (k) { return '<button data-k="' + k + '" class="' + ("÷×−+".indexOf(k) >= 0 ? "op" : "") + '">' + k + "</button>"; }).join("") +
      '<button data-k="=" class="eq" style="grid-column:span 4">=</button></div></div>';
  }
  function calcPress(k) {
    var e = S.calcExpr;
    if (k === "C") e = "";
    else if (k === "⌫") e = e.slice(0, -1);
    else if (k === "=") {
      var src = e.replace(/,/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
      if (/^[0-9+\-*/(). ]+$/.test(src)) {
        try { var v = Function('"use strict";return (' + src + ")")(); e = isFinite(v) ? (Math.round(v * 1e6) / 1e6).toLocaleString("ko-KR") : "오류"; } catch (x) { e = "오류"; }
      } else e = "오류";
    } else { if (e === "오류") e = ""; e += k; }
    S.calcExpr = e; var d = document.getElementById("cd"); if (d) d.textContent = e || "0";
  }

  function renderQuiz() {
    var s = S.session; if (!s) { go("home", false); return; }
    var it = s.items[s.idx], q = BY_ID[it.id], exam = s.mode === "exam", n = s.items.length;
    var h = '<div class="q-head"><button class="iconbtn" id="quit" aria-label="그만하기" style="margin-left:-10px">✕</button><span>' + esc(s.title) + "</span>" +
      (exam ? '<span id="timer">' + mmss(s.elapsed) + "</span>" : "<span>" + (s.idx + 1) + " / " + n + "</span>") + "</div>";
    if (exam) {
      h += '<div class="grid" role="navigation" aria-label="문항 번호">' + s.items.map(function (x, i) {
        return '<button data-g="' + i + '" class="' + (x.sel ? "done " : "") + (x.flag ? "flag " : "") + (i === s.idx ? "cur" : "") + '" aria-label="' + (i + 1) + "번" + (x.sel ? " 풀었음" : "") + (x.flag ? " 표시함" : "") + '">' + (i + 1) + "</button>";
      }).join("") + "</div>";
    } else h += '<div class="progress"><i style="width:' + Math.round((s.idx + (it.checked ? 1 : 0)) / n * 100) + '%"></i></div>';
    h += '<div class="question"><span class="qno">' + (s.idx + 1) + ".</span> " + esc(q.q) + "</div>" + dataHtml(q.x) + choiceHtml(q, it, !exam && it.checked);
    if (!exam && it.checked) {
      h += feedbackHtml(q, it, true);
      if (it.sel !== q.a) h += '<button class="btn" style="width:100%;margin-top:8px" id="twin">같은 개념 다시 풀기</button>';
    }
    var last = s.idx === n - 1, btns = "";
    if (exam) {
      btns = '<button class="btn small" id="prev" aria-label="이전"' + (s.idx === 0 ? " disabled" : "") + ">‹</button>" +
        '<button class="btn small" id="flag" aria-label="나중에 다시 보기">' + (it.flag ? "⚑" : "⚐") + "</button>" +
        '<button class="btn small" id="calc" aria-label="계산기">계산</button>' +
        '<button class="btn primary" id="next">' + (last ? "제출" : "다음") + "</button>";
    } else {
      btns = '<button class="btn small" id="calc" aria-label="계산기">계산</button>' +
        (it.checked ? '<button class="btn primary" id="next">' + (last ? "결과 보기" : "다음") + "</button>" : '<button class="btn primary" id="check"' + (it.sel ? "" : " disabled") + ">확인</button>");
    }
    app.innerHTML = h + calcHtml() + bar(btns);

    app.querySelectorAll("[data-c]").forEach(function (b) {
      b.onclick = function () { if (!exam && it.checked) return; it.sel = +b.getAttribute("data-c"); saveSession(); renderQuiz(); };
    });
    app.querySelectorAll("[data-g]").forEach(function (b) { b.onclick = function () { s.idx = +b.getAttribute("data-g"); saveSession(); renderQuiz(); window.scrollTo(0, 0); }; });
    app.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { calcPress(b.getAttribute("data-k")); }; });
    bind("quit", function () {
      if (exam && !confirm("모의고사를 그만둘까요? 홈에서 이어서 풀 수 있어요.")) return;
      if (!exam) { S.session = null; saveSession(); }
      go("home");
    });
    bind("calc", function () { S.calcOpen = !S.calcOpen; renderQuiz(); });
    bind("prev", function () { if (s.idx > 0) { s.idx--; saveSession(); renderQuiz(); window.scrollTo(0, 0); } });
    bind("flag", function () { it.flag = !it.flag; saveSession(); renderQuiz(); });
    bind("check", function () { if (!it.sel) return; it.checked = true; saveSession(); renderQuiz(); });
    bind("twin", function () {
      var t = twinOf(it.id, s.used);
      if (!t) { alert("이 개념의 다른 문제가 아직 없어요."); return; }
      if (!t.fresh) alert("이 개념 문제를 모두 풀었어요. 앞에서 푼 문제를 다시 낼게요.");
      s.items.splice(s.idx + 1, 0, { id: t.q.id, sel: 0, flag: false, checked: false, twin: true });
      s.used.push(t.q.id); s.idx++; saveSession(); renderQuiz(); window.scrollTo(0, 0);
    });
    bind("next", function () {
      if (!last) { s.idx++; saveSession(); renderQuiz(); window.scrollTo(0, 0); return; }
      if (exam) {
        var blank = s.items.filter(function (x) { return !x.sel; }).length;
        if (blank && !confirm(blank + "문항을 아직 안 풀었어요. 제출할까요?")) return;
      }
      finish();
    });
    if (exam) timerOn();
  }

  function finish() {
    var s = S.session; s.submitted = true;
    var correct = s.items.filter(function (x) { return x.sel === BY_ID[x.id].a; }).length;
    sset("localStorage", "passup.last", { title: s.title, correct: correct, total: s.items.length, at: Date.now() });
    saveSession(); go("result");
  }

  function renderResult() {
    var s = S.session; if (!s) { go("home", false); return; }
    var items = s.items, correct = 0, by = {}, weak = {};
    AREAS.forEach(function (a) { by[a] = [0, 0]; });
    items.forEach(function (x) {
      var q = BY_ID[x.id], ok = x.sel === q.a, a = areaOf(q);
      if (ok) correct++;
      by[a][1]++; if (ok) by[a][0]++;
      if (!ok) weak[q.t] = (weak[q.t] || 0) + 1;
    });
    var exam = s.mode === "exam";
    var h = '<div class="top"><button class="iconbtn" id="home" aria-label="홈">‹ 홈</button><div></div></div>' +
      '<div class="score"><div class="sub">' + esc(s.title) + " 결과</div>" +
      (exam ? '<div class="big">' + correct * 2 + '<span class="sub" style="font-size:.35em"> / 30점</span></div><div class="sub">' + correct + " / " + items.length + " 정답 · " + mmss(s.elapsed) + "</div>"
        : '<div class="big">' + correct + '<span class="sub" style="font-size:.35em"> / ' + items.length + "</span></div>") + "</div>";
    h += '<div class="card">' + AREAS.filter(function (a) { return by[a][1]; }).map(function (a) {
      return '<div class="row"><span>' + a + "</span><span" + (by[a][0] < by[a][1] ? ' style="color:var(--bad);font-weight:700"' : "") + ">" + by[a][0] + " / " + by[a][1] + "</span></div>";
    }).join("") + "</div>";
    var wk = Object.keys(weak);
    if (wk.length) {
      h += "<h2>다시 볼 주제</h2><div class=\"list\">" + wk.map(function (t) {
        return '<button data-t="' + t + '"><span>' + esc(topicName(t)) + '</span><span class="pill">' + weak[t] + "문항 틀림</span></button>";
      }).join("") + "</div>";
    }
    h += "<h2>문항별 확인</h2><div class=\"list\">" + items.map(function (x, i) {
      var q = BY_ID[x.id], ok = x.sel === q.a;
      return '<button data-r="' + i + '"><span>' + (i + 1) + ". " + esc(topicName(q.t)) + '</span><span style="color:var(--' + (ok ? "ok" : "bad") + ');font-weight:700">' + (ok ? "✓" : "✗") + "</span></button>";
    }).join("") + "</div>";
    var wrong = items.filter(function (x) { return x.sel !== BY_ID[x.id].a; }).map(function (x) { return x.id; });
    app.innerHTML = h + bar(wrong.length ? '<button class="btn primary" id="retry">틀린 개념 다시 풀기 (' + wrong.length + ")</button>" : '<button class="btn primary" id="home2">홈으로</button>');
    bind("home", function () { S.session = null; saveSession(); go("home"); });
    bind("home2", function () { S.session = null; saveSession(); go("home"); });
    bind("retry", function () { startRetry(wrong); });
    app.querySelectorAll("[data-t]").forEach(function (b) { b.onclick = function () { startTopic(b.getAttribute("data-t")); }; });
    app.querySelectorAll("[data-r]").forEach(function (b) { b.onclick = function () { S.reviewIdx = +b.getAttribute("data-r"); go("review"); }; });
  }

  function renderReview() {
    var s = S.session, i = S.reviewIdx || 0, it = s.items[i], q = BY_ID[it.id], n = s.items.length;
    var h = '<div class="q-head"><button class="iconbtn" id="back" style="margin-left:-10px">‹ 결과</button><span>' + (i + 1) + " / " + n + "</span></div>" +
      '<div class="question"><span class="qno">' + (i + 1) + ".</span> " + esc(q.q) + "</div>" + dataHtml(q.x) + choiceHtml(q, it, true) + feedbackHtml(q, it, true);
    app.innerHTML = h + bar('<button class="btn small" id="p"' + (i === 0 ? " disabled" : "") + ' aria-label="이전">‹</button><button class="btn primary" id="nx">' + (i === n - 1 ? "결과로" : "다음 문항") + "</button>");
    bind("back", function () { history.back(); });
    bind("p", function () { S.reviewIdx = i - 1; renderReview(); window.scrollTo(0, 0); });
    bind("nx", function () { if (i === n - 1) history.back(); else { S.reviewIdx = i + 1; renderReview(); window.scrollTo(0, 0); } });
  }

  function bind(id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; }

  // ---------- 시작 ----------
  function start() {
    if (sget("localStorage", "passup.big")) document.documentElement.classList.add("big");
    var saved = sget("sessionStorage", "passup.session");
    if (saved && saved.items && saved.items.every(function (x) { return BY_ID[x.id]; })) S.session = saved;
    try { history.replaceState({ s: "home" }, ""); } catch (e) {}
    S.screen = "home"; render();
  }
  if (sget("localStorage", "passup.big")) document.documentElement.classList.add("big");
  fetch("data/k1.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) {
    DATA = d;
    d.topics.forEach(function (t) { TOPIC[t.code] = t; });
    d.questions.forEach(function (q) { BY_ID[q.id] = q; (BY_GROUP[q.g] = BY_GROUP[q.g] || []).push(q); });
    if (checkAccess()) start(); else renderGate();
  }).catch(function () {
    app.innerHTML = '<div class="loading">문제를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.</div>';
  });
})();
