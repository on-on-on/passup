(function () {
  "use strict";
  var CFG = window.PASSUP_CONFIG || {};
  var app = document.getElementById("app");
  var DATA = null, BY_ID = {}, BY_GROUP = {}, TOPIC = {};
  var S = { screen: "home", session: null, calcOpen: false, calcExpr: "" };
  var CIRC = ["①", "②", "③", "④"];
  var AREAS = ["재무회계", "원가회계", "부가가치세", "소득세"];
  var SUBJ = {
    k1: { name: "전산회계 1급", file: "data/k1.json" },
    t2: { name: "전산세무 2급", file: "data/t2.json" }
  };
  S.subj = (function () { var v = sget0("passup.subj"); return SUBJ[v] ? v : "k1"; })();
  function sget0(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function sfx(base) { return S.subj === "k1" ? base : base + "." + S.subj; }
  var AREA_SHORT = { "재무회계": "재무회계", "원가회계": "원가회계", "부가가치세": "부가세", "소득세": "소득세" };
  var MAX_NOTE_SET = 15;

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
  function topicOrder(q) { for (var i = 0; i < DATA.topics.length; i++) if (DATA.topics[i].code === q.t) return i; return 999; }

  // ---------- 오답노트(이 기기에만 저장) ----------
  function notes() { var w = sget("localStorage", sfx("passup.wrong")); return w && typeof w === "object" ? w : {}; }
  function noteIds() { var w = notes(); return Object.keys(w).filter(function (id) { return BY_ID[id]; }); }
  function addNote(id) { var w = notes(); if (!w[id]) w[id] = { at: Date.now() }; sset("localStorage", sfx("passup.wrong"), w); }
  function delNote(id) { var w = notes(); if (w[id]) { delete w[id]; sset("localStorage", sfx("passup.wrong"), w); } }

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
      '<div style="margin-top:14px"><button class="btn primary" style="width:100%" id="go">입장</button></div>' + noticeHtml() + "</div>";
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
    return '<div class="logo"><picture><source srcset="logo-w.png" media="(prefers-color-scheme: dark)"><img src="logo.png" alt="PASS UP"></picture>' +
      (CFG.byline ? '<span class="by">' + esc(CFG.byline) + "</span>" : "") + "</div>";
  }
  function noticeHtml() {
    return CFG.notice ? '<p class="foot">' + esc(CFG.notice) + "</p>" : "";
  }
  function dday() {
    var t = today(), list = (CFG.exams || []).map(function (e) { var p = e.date.split("-"); return { round: e.round, d: new Date(+p[0], +p[1] - 1, +p[2]) }; })
      .filter(function (e) { return e.d >= t; }).sort(function (a, b) { return a.d - b.d; });
    if (!list.length) return { label: "공고 전", sub: "다음 시험 일정" };
    var n = Math.round((list[0].d - t) / 864e5);
    return { label: n === 0 ? "D-Day" : "D-" + n, sub: "제" + list[0].round + "회 · " + (list[0].d.getMonth() + 1) + "." + list[0].d.getDate() };
  }
  function bar(html) { return '<div class="bar"><div class="in">' + html + "</div></div>"; }
  // ---------- 오류 신고(사이트 안에서 바로 접수) ----------
  function formUrl(q) {
    return (CFG.reportFormUrl || "").replace("{id}", encodeURIComponent(q.id)).replace("{subject}", encodeURIComponent(DATA.subject));
  }
  function reported() { var r = sget("localStorage", "passup.reported"); return r && typeof r === "object" ? r : {}; }
  function reportBtn(q) {
    if (!CFG.reportPost && !CFG.reportFormUrl) return "";
    var done = reported()[q.id];
    return '<button class="rep' + (done ? " done" : "") + '" data-rep="' + esc(q.id) + '">' + (done ? "신고함" : "오류 신고") + "</button>";
  }
  function bindReports() {
    app.querySelectorAll("[data-rep]").forEach(function (b) { b.onclick = function () { openReport(BY_ID[b.getAttribute("data-rep")]); }; });
  }
  function toast(msg) {
    var t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }
  function openReport(q) {
    var P = CFG.reportPost;
    if (!P) { window.open(formUrl(q), "_blank", "noopener"); return; }
    var old = document.getElementById("rep-bg"); if (old) old.remove();
    var bg = document.createElement("div"); bg.id = "rep-bg"; bg.className = "sheet-bg";
    bg.innerHTML = '<div class="sheet" role="dialog" aria-label="오류 신고"><div class="sheet-h"><b>이 문제 오류 신고</b><span class="sub">' + esc(q.id) + "</span></div>" +
      '<div class="sub" style="margin:2px 0 10px">어떤 오류인가요?</div><div class="chips">' +
      P.types.map(function (t, i) { return '<button data-ty="' + i + '">' + esc(t) + "</button>"; }).join("") + "</div>" +
      '<textarea id="rep-memo" rows="3" maxlength="500" placeholder="자세한 내용 (선택)"></textarea>' +
      '<div class="navrow" style="margin:12px 0 0"><button class="btn" id="rep-x">취소</button><button class="btn primary" id="rep-send" disabled>보내기</button></div></div>';
    document.body.appendChild(bg);
    var picked = -1, send = document.getElementById("rep-send");
    function close() { bg.remove(); }
    bg.onclick = function (e) { if (e.target === bg) close(); };
    document.getElementById("rep-x").onclick = close;
    bg.querySelectorAll("[data-ty]").forEach(function (b) {
      b.onclick = function () {
        picked = +b.getAttribute("data-ty");
        bg.querySelectorAll("[data-ty]").forEach(function (x) { x.classList.toggle("on", x === b); });
        send.disabled = false;
      };
    });
    send.onclick = function () {
      if (picked < 0) return;
      send.disabled = true; send.textContent = "보내는 중…";
      var body = new URLSearchParams();
      body.append(P.id, q.id); body.append(P.subject, DATA.subject); body.append(P.type, P.types[picked]);
      var memo = document.getElementById("rep-memo").value.trim(); if (memo) body.append(P.memo, memo);
      fetch(P.action, { method: "POST", mode: "no-cors", body: body }).then(function () {
        var r = reported(); r[q.id] = Date.now(); sset("localStorage", "passup.reported", r);
        close(); toast("신고가 접수됐어요. 확인 후 고칠게요.");
        app.querySelectorAll('[data-rep="' + q.id + '"]').forEach(function (b) { b.classList.add("done"); b.textContent = "신고함"; });
      }).catch(function () {
        send.disabled = false; send.textContent = "다시 보내기";
        toast("보내지 못했어요. 인터넷 연결을 확인해 주세요.");
      });
    };
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
  // mode: exam(시험 모드) | practice(연습 모드) | note(오답노트 풀이)
  function saveSession() { if (S.session) sset("sessionStorage", sfx("passup.session"), S.session); else sdel("sessionStorage", sfx("passup.session")); }
  function newSession(mode, title, list) {
    S.session = {
      mode: mode, title: title, idx: 0, elapsed: 0, submitted: false,
      items: list.map(function (x) { return typeof x === "string" ? { id: x, sel: 0 } : { id: x.id, src: x.src, sel: 0 }; })
    };
    saveSession();
    go("quiz");
  }
  function pickExam() {
    var spec, usedG = {}, ids = [];
    if (S.subj === "t2") { var nv = 2 + Math.floor(Math.random() * 2); spec = [["재무회계", 5], ["원가회계", 5], ["부가가치세", nv], ["소득세", 5 - nv]]; }
    else spec = [["재무회계", 8], ["원가회계", 4], ["부가가치세", 3]];
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
      got.sort(function (a, b) { return topicOrder(a) - topicOrder(b); });
      got.forEach(function (q) { ids.push(q.id); });
    });
    return ids;
  }
  function twinOf(id, used) {
    var q = BY_ID[id], group = BY_GROUP[q.g] || [];
    var fresh = shuffle(group.filter(function (x) { return x.id !== id && used.indexOf(x.id) < 0; }));
    if (fresh.length) return fresh[0];
    var any = shuffle(group.filter(function (x) { return x.id !== id; }));
    return any.length ? any[0] : null;
  }
  // 오답 목록 → 풀이 세트(영역 순 정렬). similar=true면 같은 개념의 다른 문제로 바꿔서 출제
  function noteSet(ids, similar) {
    var used = ids.slice(), out = [];
    ids.forEach(function (id) {
      var nid = id;
      if (similar) { var t = twinOf(id, used); if (t) { nid = t.id; used.push(nid); } }
      out.push({ id: nid, src: id });
    });
    out.sort(function (a, b) { return topicOrder(BY_ID[a.id]) - topicOrder(BY_ID[b.id]); });
    return out;
  }
  function startNote(similar) {
    var w = notes();
    var ids = noteIds().sort(function (a, b) { return w[a].at - w[b].at; }).slice(0, MAX_NOTE_SET);
    if (!ids.length) return;
    newSession("note", similar ? "오답노트 · 비슷한 문제" : "오답노트 · 다시 풀기", noteSet(ids, similar));
  }
  function confirmNew() {
    var cur = S.session && !S.session.submitted ? S.session : null;
    return !cur || confirm("풀던 문제가 있어요. 새로 시작할까요?");
  }

  // ---------- 화면 전환 ----------
  function go(screen, push) {
    S.screen = screen; S.calcOpen = false;
    if (push !== false) { try { history.pushState({ s: screen }, ""); } catch (e) {} }
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", function () {
    if (S.screen === "quiz" && S.session && !S.session.submitted && S.session.mode === "exam") {
      if (!confirm("시험을 그만둘까요? 처음 화면에서 이어서 풀 수 있어요.")) { try { history.pushState({ s: "quiz" }, ""); } catch (e) {} return; }
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
    else if (S.screen === "note") renderNote();
    else if (S.screen === "quiz") renderQuiz();
    else if (S.screen === "result") renderResult();
    else if (S.screen === "review") renderReview();
  }

  function renderHome() {
    var d = dday(), cur = S.session && !S.session.submitted ? S.session : null, nCount = noteIds().length;
    var h = '<div class="top">' + logoHtml() + '<button class="iconbtn" id="fs" aria-label="글자 크기">가' + (document.documentElement.classList.contains("big") ? "-" : "+") + "</button></div>" +
      '<div class="card"><div class="sub">다음 시험</div><div class="big-num">' + esc(d.label) + '</div><div class="sub">' + esc(d.sub) + "</div></div>";
    if (cur) h += '<button class="card menu hero" id="resume"><div class="sub">풀던 문제가 있어요</div><div class="t">' + esc(cur.title) + " 이어서 풀기</div></button>";
    h += '<div class="label">종목</div><div class="seg">' +
      Object.keys(SUBJ).map(function (k) { return '<button data-subj="' + k + '" class="' + (k === S.subj ? "on" : "") + '" aria-pressed="' + (k === S.subj) + '">' + esc(SUBJ[k].name) + "</button>"; }).join("") + "</div>";
    h += '<div class="label">풀이 방식</div>' +
      '<button class="card menu mode" id="m-exam"><div class="t">시험 모드</div><div class="sub">15문항 · 다 풀고 한 번에 채점</div></button>' +
      '<button class="card menu mode" id="m-prac"><div class="t">연습 모드</div><div class="sub">15문항 · 한 문제씩 바로 정답과 해설 확인</div></button>' +
      '<button class="card menu note" id="m-note"><span class="t">오답노트</span><span class="badge' + (nCount ? "" : " zero") + '">' + nCount + "</span></button>";
    h += noticeHtml();
    app.innerHTML = h;
    bind("fs", function () { var on = document.documentElement.classList.toggle("big"); sset("localStorage", "passup.big", on); renderHome(); });
    bind("resume", function () { go("quiz"); });
    bind("m-exam", function () { if (confirmNew()) newSession("exam", "시험 모드", pickExam()); });
    bind("m-prac", function () { if (confirmNew()) newSession("practice", "연습 모드", pickExam()); });
    bind("m-note", function () { go("note"); });
    app.querySelectorAll("[data-subj]").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-subj"); if (k === S.subj) return;
        b.textContent = "불러오는 중…";
        loadSubject(k, function () { sset("localStorage", "passup.subj", k); restoreSession(); renderHome(); });
      };
    });
  }

  function renderNote() {
    var ids = noteIds(), n = ids.length;
    var h = '<div class="top"><button class="iconbtn" id="back" aria-label="처음으로" style="margin-left:-10px">‹ 처음</button><div></div></div><h1>오답노트</h1>' +
      '<p class="sub" style="margin-top:-6px">틀린 문제가 자동으로 모여요. 오답노트에서 다시 풀어 맞히면 빠져요.</p>';
    if (!n) {
      h += '<div class="card center" style="padding:28px 16px"><div class="t" style="font-weight:700">아직 틀린 문제가 없어요</div><div class="sub">시험 모드나 연습 모드에서 틀린 문제가 여기에 모여요.</div></div>';
    } else {
      h += '<div class="card"><div class="sub">모인 문제</div><div class="big-num">' + n + '<span class="sub" style="font-size:.5em"> 문항</span></div>' +
        (n > MAX_NOTE_SET ? '<div class="sub">한 번에 오래된 순으로 ' + MAX_NOTE_SET + "문항씩 풀어요.</div>" : "") + "</div>" +
        '<button class="card menu mode" id="w-same"><div class="t">틀린 문제 다시 풀기</div><div class="sub">같은 문제를 한 번 더</div></button>' +
        '<button class="card menu mode" id="w-sim"><div class="t">비슷한 문제로 풀기</div><div class="sub">같은 개념, 숫자·보기가 다른 문제로</div></button>';
      var by = {};
      ids.forEach(function (id) { var q = BY_ID[id], a = areaOf(q); (by[a] = by[a] || {})[q.t] = (by[a][q.t] || 0) + 1; });
      AREAS.forEach(function (a) {
        if (!by[a]) return;
        h += '<div class="area-title">' + a + '</div><div class="card" style="padding:4px 16px">' + Object.keys(by[a]).sort(function (x, y) { return topicOrder({ t: x }) - topicOrder({ t: y }); }).map(function (t) {
          return '<div class="row"><span>' + esc(topicName(t)) + '</span><span class="pill">' + by[a][t] + "문항</span></div>";
        }).join("") + "</div>";
      });
      h += '<div class="center"><button class="link" id="w-clear">오답노트 비우기</button></div>';
    }
    h += '<div class="notice">오답노트는 이 폰에만 저장돼요. 카톡 캐시를 지우거나 폰을 바꾸면 사라질 수 있어요.</div>';
    app.innerHTML = h;
    bind("back", function () { history.back(); });
    bind("w-same", function () { if (confirmNew()) startNote(false); });
    bind("w-sim", function () { if (confirmNew()) startNote(true); });
    bind("w-clear", function () { if (confirm("오답노트를 모두 지울까요?")) { sdel("localStorage", sfx("passup.wrong")); renderNote(); } });
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
  function feedbackHtml(q, it) {
    var ok = it.sel === q.a;
    var title = !it.sel ? "안 푼 문제예요 · 정답은 " + CIRC[q.a - 1] + "번" : ok ? "정답이에요" : "정답은 " + CIRC[q.a - 1] + "번이에요";
    var h = '<div class="fb ' + (ok ? "ok" : "bad") + '"><b class="fb-t">' + title + "</b>" +
      (q.p ? '<div class="trap"><b>이 문제의 함정</b>' + esc(q.p) + "</div>" : "") +
      '<div class="exp">' + esc(q.e) + "</div>" +
      '<div class="meta">' + esc(topicName(q.t)) + " · " + esc(q.id) + "</div></div>";
    return h;
  }
  function calcHtml() {
    if (!S.calcOpen) return "";
    var keys = ["C", "⌫", "(", ")", "7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", "00", ".", "+"];
    return '<div class="calc" role="dialog" aria-label="계산기"><div class="disp" id="cd">' + esc(S.calcExpr || "0") + '</div><div class="keys">' +
      keys.map(function (k) { return '<button data-k="' + k + '" class="' + ("÷×−+".indexOf(k) >= 0 ? "op" : "") + '">' + k + "</button>"; }).join("") +
      '<button data-k="=" class="eq" style="grid-column:span 3">=</button><button data-k="닫기" style="grid-column:span 1">닫기</button></div></div>';
  }
  function calcPress(k) {
    if (k === "닫기") { S.calcOpen = false; renderQuiz(); return; }
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

  // OMR 답안지: 영역별 줄, 한 줄 최대 8문항
  function omrHtml(s) {
    var exam = s.mode === "exam", groups = [], marked = 0;
    s.items.forEach(function (x, i) {
      if (x.sel) marked++;
      var a = areaOf(BY_ID[x.id]), g = groups[groups.length - 1];
      if (!g || g.area !== a) { g = { area: a, idxs: [] }; groups.push(g); }
      g.idxs.push(i);
    });
    var rows = "";
    groups.forEach(function (g) {
      for (var k = 0; k < g.idxs.length; k += 8) {
        rows += '<div class="omr-row"><div class="omr-lab">' + (k === 0 ? esc(AREA_SHORT[g.area] || g.area) : "") + "</div>" +
          g.idxs.slice(k, k + 8).map(function (i) {
            var x = s.items[i], q = BY_ID[x.id], reveal = !exam && x.sel, cls = "omr-cell";
            if (i === s.idx) cls += " cur";
            if (reveal) cls += x.sel === q.a ? " ok" : " ng";
            var b = "";
            for (var c = 1; c <= 4; c++) {
              var bc = "bub";
              if (x.sel === c) bc += " on" + (reveal ? (c === q.a ? " right" : " bad") : "");
              b += '<span class="' + bc + '" data-b="' + i + ":" + c + '" aria-hidden="true"></span>';
            }
            return '<div class="' + cls + '" data-g="' + i + '" role="button" aria-label="' + (i + 1) + "번" + (x.sel ? " 표기함" : "") + '"><span class="omr-n">' + (i + 1) + "</span>" + b + "</div>";
          }).join("") + "</div>";
      }
    });
    return '<div class="omr"><div class="omr-h"><b>답안지</b><span>' + marked + " / " + s.items.length + " 표기</span></div>" + rows + "</div>";
  }

  function renderQuiz() {
    var s = S.session; if (!s) { go("home", false); return; }
    var it = s.items[s.idx], q = BY_ID[it.id], exam = s.mode === "exam", n = s.items.length;
    var reveal = !exam && !!it.sel, last = s.idx === n - 1;
    var h = '<div class="q-top"><button class="iconbtn" id="quit" aria-label="처음으로">처음</button><b>' + esc(s.title) + "</b>" +
      '<span class="cnt">' + (exam ? '<span id="timer">' + mmss(s.elapsed) + "</span>" : (s.idx + 1) + " / " + n) + "</span></div>";
    h += '<div class="q-meta"><span class="area">' + esc(areaOf(q)) + "</span>" + reportBtn(q) + "</div>";
    h += '<div class="question"><span class="qno">' + (s.idx + 1) + ".</span> " + esc(q.q) + "</div>" + dataHtml(q.x) + choiceHtml(q, it, reveal);
    if (reveal) h += feedbackHtml(q, it);
    var nextLabel = last ? (exam ? "제출" : "결과 보기") : "다음";
    h += '<div class="navrow"><button class="btn" id="prev"' + (s.idx === 0 ? " disabled" : "") + ">이전</button>" +
      '<button class="btn small" id="calc" aria-label="계산기">계산</button>' +
      '<button class="btn primary" id="next">' + nextLabel + "</button></div>";
    h += omrHtml(s);
    app.innerHTML = h + calcHtml();
    bindReports();

    function goIdx(i) { s.idx = i; saveSession(); renderQuiz(); window.scrollTo(0, 0); }
    function answer(item, c) {
      if (!exam && item.sel) return;              // 연습·오답노트: 한 번 고르면 확정
      item.sel = c;
      if (!exam) {
        var qq = BY_ID[item.id], key = item.src || item.id;
        if (c !== qq.a) addNote(key);
        else if (s.mode === "note") delNote(key);
      }
      saveSession();
    }
    app.querySelectorAll("[data-c]").forEach(function (b) {
      b.onclick = function () { answer(it, +b.getAttribute("data-c")); renderQuiz(); };
    });
    var omr = app.querySelector(".omr");
    if (omr) omr.onclick = function (e) {
      var bub = e.target.closest ? e.target.closest("[data-b]") : null;
      if (bub && exam) {
        var p = bub.getAttribute("data-b").split(":"), i = +p[0];
        answer(s.items[i], +p[1]); s.idx = i; saveSession(); renderQuiz(); return;
      }
      var cell = e.target.closest ? e.target.closest("[data-g]") : null;
      if (cell) goIdx(+cell.getAttribute("data-g"));
    };
    app.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { calcPress(b.getAttribute("data-k")); }; });
    bind("quit", function () {
      if (exam && !confirm("시험을 그만둘까요? 처음 화면에서 이어서 풀 수 있어요.")) return;
      go("home");
    });
    bind("calc", function () { S.calcOpen = !S.calcOpen; renderQuiz(); });
    bind("prev", function () { if (s.idx > 0) goIdx(s.idx - 1); });
    bind("next", function () {
      if (!last) { goIdx(s.idx + 1); return; }
      var blank = s.items.filter(function (x) { return !x.sel; }).length;
      if (blank && !confirm(blank + "문항을 아직 안 풀었어요. " + (exam ? "제출할까요?" : "결과를 볼까요?"))) return;
      finish();
    });
    if (exam) timerOn();
  }

  function finish() {
    var s = S.session; s.submitted = true;
    if (s.mode === "exam") s.items.forEach(function (x) { if (x.sel !== BY_ID[x.id].a) addNote(x.src || x.id); });
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
    var full = items.length === 15 && s.mode !== "note";
    var h = '<div class="top"><button class="iconbtn" id="home" aria-label="처음으로" style="margin-left:-10px">‹ 처음</button><div></div></div>' +
      '<div class="score"><div class="sub">' + esc(s.title) + " 결과</div>" +
      (full ? '<div class="big">' + correct * 2 + '<span class="sub" style="font-size:.35em"> / 30점</span></div><div class="sub">' + correct + " / " + items.length + " 정답" + (s.mode === "exam" ? " · " + mmss(s.elapsed) : "") + "</div>"
        : '<div class="big">' + correct + '<span class="sub" style="font-size:.35em"> / ' + items.length + "</span></div>") + "</div>";
    h += '<div class="card">' + AREAS.filter(function (a) { return by[a][1]; }).map(function (a) {
      return '<div class="row"><span>' + a + "</span><span" + (by[a][0] < by[a][1] ? ' style="color:var(--bad);font-weight:700"' : "") + ">" + by[a][0] + " / " + by[a][1] + "</span></div>";
    }).join("") + "</div>";
    var wk = Object.keys(weak);
    if (wk.length) {
      h += '<h2>다시 볼 주제</h2><div class="card" style="padding:4px 16px">' + wk.map(function (t) {
        return '<div class="row"><span>' + esc(topicName(t)) + '</span><span class="pill">' + weak[t] + "문항 틀림</span></div>";
      }).join("") + "</div>";
      h += '<p class="sub" style="margin:8px 2px 0">틀린 문제는 오답노트에 모였어요.</p>';
    }
    h += "<h2>문항별 확인</h2><div class=\"list\">" + items.map(function (x, i) {
      var q = BY_ID[x.id], ok = x.sel === q.a;
      return '<button data-r="' + i + '"><span>' + (i + 1) + ". " + esc(topicName(q.t)) + '</span><span style="color:var(--' + (ok ? "ok" : "bad") + ');font-weight:700">' + (ok ? "✓" : "✗") + "</span></button>";
    }).join("") + "</div>";
    var hasNote = noteIds().length > 0;
    app.innerHTML = h + bar('<button class="btn" id="home2">처음으로</button>' + (hasNote ? '<button class="btn primary" id="tonote">오답노트</button>' : ""));
    function leave(screen) { S.session = null; saveSession(); go(screen); }
    bind("home", function () { leave("home"); });
    bind("home2", function () { leave("home"); });
    bind("tonote", function () { leave("note"); });
    app.querySelectorAll("[data-r]").forEach(function (b) { b.onclick = function () { S.reviewIdx = +b.getAttribute("data-r"); go("review"); }; });
  }

  function renderReview() {
    var s = S.session; if (!s) { go("home", false); return; }
    var i = S.reviewIdx || 0, it = s.items[i], q = BY_ID[it.id], n = s.items.length;
    var h = '<div class="q-head"><button class="iconbtn" id="back" style="margin-left:-10px">‹ 결과</button><span>' + (i + 1) + " / " + n + "</span></div>" +
      '<div class="q-meta"><span class="area">' + esc(areaOf(q)) + "</span>" + reportBtn(q) + "</div>" +
      '<div class="question"><span class="qno">' + (i + 1) + ".</span> " + esc(q.q) + "</div>" + dataHtml(q.x) + choiceHtml(q, it, true) + feedbackHtml(q, it);
    app.innerHTML = h + bar('<button class="btn small" id="p"' + (i === 0 ? " disabled" : "") + ' aria-label="이전">‹</button><button class="btn primary" id="nx">' + (i === n - 1 ? "결과로" : "다음 문항") + "</button>");
    bindReports();
    bind("back", function () { history.back(); });
    bind("p", function () { S.reviewIdx = i - 1; renderReview(); window.scrollTo(0, 0); });
    bind("nx", function () { if (i === n - 1) history.back(); else { S.reviewIdx = i + 1; renderReview(); window.scrollTo(0, 0); } });
  }

  function bind(id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; }

  // ---------- 시작 ----------
  function restoreSession() {
    var saved = sget("sessionStorage", sfx("passup.session"));
    S.session = (saved && saved.items && saved.mode && saved.items.every(function (x) { return BY_ID[x.id]; })) ? saved : null;
  }
  function loadSubject(k, cb) {
    fetch(SUBJ[k].file, { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) {
      S.subj = k; DATA = d; BY_ID = {}; BY_GROUP = {}; TOPIC = {};
      d.topics.forEach(function (t) { TOPIC[t.code] = t; });
      d.questions.forEach(function (q) { BY_ID[q.id] = q; (BY_GROUP[q.g] = BY_GROUP[q.g] || []).push(q); });
      cb();
    }).catch(function () {
      app.innerHTML = '<div class="loading">문제를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.</div>';
    });
  }
  function start() {
    if (sget("localStorage", "passup.big")) document.documentElement.classList.add("big");
    restoreSession();
    try { history.replaceState({ s: "home" }, ""); } catch (e) {}
    S.screen = "home"; render();
  }
  if (sget("localStorage", "passup.big")) document.documentElement.classList.add("big");
  loadSubject(S.subj, function () { if (checkAccess()) start(); else renderGate(); });
})();
