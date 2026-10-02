/* ==========================================================================
   views.js — all pages: Landing, Live, Sign Library, Practice, History, Admin.
   Each view returns { title, html, mount(root, params) }.
   ========================================================================== */

import { store, CATEGORIES, uid } from "./store.js";
import { LiveSession, getSharedTracker } from "./session.js";
import { toFeatures, Recognizer } from "./cv.js";
import { esc, $, $$, toast, speak, stopSpeech, copyText, download,
         fmtTime, fmtDateTime, relTime, speechAvailable } from "./helpers.js";

/* ====================================================================== */
/* shared bits                                                            */
/* ====================================================================== */

function signCard(s) {
  const thumb = s.image
    ? `<img src="${esc(s.image)}" alt="Example of the ${esc(s.name)} sign" loading="lazy">`
    : `<span aria-hidden="true">${esc(s.emoji || "🤟")}</span>`;
  return `
  <article class="card sign-card">
    <div class="sign-thumb" role="img" aria-label="Illustration for ${esc(s.name)}">${thumb}</div>
    <div class="spread">
      <h3 style="margin:0">${esc(s.name)}</h3>
      <span class="badge">${esc(s.category)}</span>
    </div>
    <p class="muted small" style="margin:0">${esc(s.meaning)}</p>
    ${s.example ? `<p class="small" style="margin:0"><strong>Example:</strong> “${esc(s.example)}”</p>` : ""}
    <div class="row" style="gap:8px">
      <span class="badge info">${esc(s.difficulty || "Easy")}</span>
      <span class="badge">${esc(s.type === "dynamic" ? "Dynamic" : "Static")}</span>
      ${s.samples?.length ? `<span class="badge good">${s.samples.length} samples</span>` : `<span class="badge warn">Not taught</span>`}
    </div>
    <a class="btn secondary sm" href="#/practice?sign=${encodeURIComponent(s.id)}">Practice this sign</a>
  </article>`;
}

function statCard(icon, n, k) {
  return `<div class="card stat"><div class="ico" aria-hidden="true">${icon}</div>
    <div class="n">${esc(n)}</div><div class="k">${esc(k)}</div></div>`;
}

function privacyNotice() {
  return `<div class="notice info" role="note">
    <strong>Your camera, your data.</strong> The camera is used only to detect hand
    gestures. No video or images ever leave your device — only the numeric hand
    landmarks you choose to save as training samples are kept, in this browser.
    You can delete any sample at any time.</div>`;
}

/* ====================================================================== */
/* 1. Landing                                                             */
/* ====================================================================== */

export function landing() {
  const stats = store.stats();
  return {
    title: "SignBridge AI — Bridging Communication Through AI",
    html: `
    <section class="hero">
      <div class="wrap" style="padding:64px 18px 40px">
        <span class="badge info">AI accessibility platform · Prototype</span>
        <h1 style="max-width:16ch;margin-top:14px">Bridging Communication Through AI.</h1>
        <p class="muted" style="font-size:1.2rem;max-width:52ch">
          Understand signs. Learn gestures. Communicate without barriers — a platform to help
          people communicate with sign-language users and children who sign.</p>
        <div class="btn-row" style="margin-top:22px">
          <a class="btn" href="#/live">🤟 Start communicating</a>
          <a class="btn secondary" href="#/library">Explore sign library</a>
        </div>
        <div class="flow" style="margin-top:34px" aria-label="How a sign becomes speech">
          <span class="node">Hand gesture</span><span class="arrow" aria-hidden="true">→</span>
          <span class="node">AI recognition</span><span class="arrow" aria-hidden="true">→</span>
          <span class="node">Text</span><span class="arrow" aria-hidden="true">→</span>
          <span class="node">Voice</span>
        </div>
      </div>
    </section>

    <section class="section tight"><div class="wrap">
      <div class="grid cols-4">
        ${statCard("✋", stats.totalSigns, "Signs in library")}
        ${statCard("🎯", stats.trained, "Signs taught")}
        ${statCard("📦", stats.totalSamples, "Training samples")}
        ${statCard("💬", stats.recognitionsToday, "Recognitions today")}
      </div>
    </div></section>

    <section class="section"><div class="wrap">
      <h2>How it works</h2>
      <div class="steps">
        ${[
          ["Show your sign", "Hold your hand in front of the camera."],
          ["AI detects your hand", "21 landmark points are tracked in real time, on your device."],
          ["The gesture is interpreted", "A classifier compares it with the signs it has learned."],
          ["Text is generated", "The recognised sign becomes readable text."],
          ["Voice communicates it", "The text is spoken aloud through your device's speech engine."],
        ].map(([t, d], i) => `<div class="step"><div class="num" aria-hidden="true">${i + 1}</div>
          <div><h3 style="margin:0 0 2px">${t}</h3><p class="muted" style="margin:0">${d}</p></div></div>`).join("")}
      </div>
    </div></section>

    <section class="section tight"><div class="wrap">
      <h2>Features</h2>
      <div class="grid cols-3">
        ${[
          ["🎥", "Real-time recognition", "Live hand-landmark tracking with confidence scoring and honest low-confidence handling."],
          ["🧠", "Gesture training", "Admins create signs and capture multiple samples to teach the recogniser."],
          ["📚", "Sign library", "A searchable library of signs with meanings, categories and example sentences."],
          ["🎯", "Practice mode", "Learn signs with instant feedback and progress tracking."],
          ["🔊", "Text-to-speech", "Every recognised sign can be spoken aloud using the Web Speech API."],
          ["♿", "Accessibility first", "Large type, high contrast, keyboard navigation and screen-reader labels throughout."],
        ].map(([i, t, d]) => `<div class="card"><div class="ico" style="font-size:1.6rem" aria-hidden="true">${i}</div>
          <h3>${t}</h3><p class="muted" style="margin:0">${d}</p></div>`).join("")}
      </div>
    </div></section>

    <section class="section tight"><div class="wrap">
      <div class="card">
        <h2 style="margin-top:0">Our mission</h2>
        <p>SignBridge AI exists to reduce the communication barriers between sign-language users
        and people who may not understand sign language. It is built to <em>support</em> human
        communication, not replace it. The platform is designed to grow — more sign languages,
        gestures, dynamic movements and models can be added over time.</p>
        <div class="btn-row"><a class="btn" href="#/live">Try live recognition</a>
        <a class="btn secondary" href="#/admin">Open the admin training module</a></div>
      </div>
    </div></section>`,
    mount() {},
  };
}

/* ====================================================================== */
/* 2. Live communication                                                  */
/* ====================================================================== */

export function live() {
  const cfg = store.getSettings();
  return {
    title: "Live Communication — SignBridge AI",
    html: `
    <div class="wrap section tight">
      <div class="spread" style="margin-bottom:16px">
        <div><h1 style="margin:0">Live communication</h1>
        <p class="muted" style="margin:4px 0 0">Sign → text → voice, in real time.</p></div>
        <span class="badge info" id="modeBadge">Prototype recognition mode</span>
      </div>

      <div class="grid live-grid" style="grid-template-columns:1.4fr 1fr;align-items:start">
        <div class="card pad-sm">
          <div class="stage">
            <video id="cam" playsinline autoplay muted aria-label="Camera preview"></video>
            <canvas id="overlay" aria-hidden="true"></canvas>
            <div class="corner">
              <span class="badge" id="camStatus"><span class="dot off"></span> Camera off</span>
              <span class="badge" id="detStatus">No hand detected</span>
            </div>
            <div class="placeholder" id="camPlaceholder">
              <div><div style="font-size:2.4rem" aria-hidden="true">🎥</div>
              <p>Tap <strong>Start camera</strong> and allow access to begin.</p></div>
            </div>
          </div>
          <div class="btn-row" style="margin-top:12px">
            <button class="btn" id="startBtn">Start camera</button>
            <button class="btn secondary" id="stopBtn" disabled>Stop</button>
            <button class="btn secondary" id="flipBtn" disabled>Flip camera</button>
          </div>
          <p class="field-hint" id="liveMsg" role="status"></p>
          <div class="row" style="margin-top:12px;gap:8px">
            <span class="badge" id="modelBadge">Model: idle</span>
            <span class="badge" id="handBadge">Hand: —</span>
            <span class="badge" id="taughtBadge">Signs taught: 0</span>
          </div>
        </div>

        <div class="stack">
          <div class="readout">
            <div class="small muted">Detected sign</div>
            <div class="val sign" id="signOut">…</div>
            <div class="small muted" style="margin-top:6px">Meaning: <span id="meaningOut">—</span></div>
            <div class="spread" style="margin-top:10px"><span class="small muted">Confidence</span>
            <strong id="confOut">0%</strong></div>
            <div class="meter" style="margin-top:6px"><i id="confBar"></i></div>
          </div>

          <div class="card">
            <div class="small muted">Converted text</div>
            <div class="transcript" id="transcript" aria-live="polite">&gt;</div>
            <div class="btn-row" style="margin-top:12px">
              <button class="btn" id="speakBtn">🔊 Speak</button>
              <button class="btn secondary" id="copyBtn">Copy text</button>
              <button class="btn secondary" id="spaceBtn">Space</button>
              <button class="btn secondary" id="clearBtn">Clear</button>
            </div>
          </div>

          <div class="notice warn" id="lowConf" hidden>
            <strong>I'm not confident about this gesture.</strong> Please try again, or confirm the
            best guess below before it is spoken.
            <div class="btn-row" style="margin-top:10px">
              <button class="btn sm" id="confirmBtn">Confirm &amp; speak: <span id="confirmGuess">—</span></button>
            </div>
          </div>

          <div class="card">
            <div class="small muted">Teach a sign — right here, no need to leave this page</div>
            <div class="row" style="margin-top:8px">
              <input id="teachName" type="text" placeholder="Sign name, e.g. HELLO" style="flex:1;min-width:0" autocomplete="off">
              <button class="btn" id="teachBtn" disabled>Capture sample</button>
            </div>
            <p class="field-hint" id="teachMsg">Hold the sign steady, then tap Capture. Repeat 5–10 times, varying the angle slightly.</p>
          </div>

          ${privacyNotice()}
        </div>
      </div>
    </div>`,
    mount(root) {
      const video = $("#cam", root), canvas = $("#overlay", root);
      let session = null, sentence = "", pending = null, dwell = 0, lastCommitted = null, facing = "user";
      let lastRaw = null;
      const recentFrames = [];

      const setMsg = (m) => { $("#liveMsg", root).textContent = m || ""; };
      const setCam = (on, label) => {
        const b = $("#camStatus", root);
        b.innerHTML = `<span class="dot ${on ? "live" : "off"}"></span> ${esc(label)}`;
      };
      const setTranscript = () => { $("#transcript", root).textContent = ">" + sentence; };

      function onStatus(s) {
        if (s.phase === "loading" || s.phase === "camera") setMsg(s.message);
        if (s.phase === "live") {
          setMsg(""); setCam(true, "Camera live"); $("#camPlaceholder", root).hidden = true;
          const mb = $("#modelBadge", root); mb.textContent = "Model: ready"; mb.className = "badge good";
          $("#teachBtn", root).disabled = false;
          updateTaught();
        }
        if (s.phase === "stopped") { setCam(false, "Camera off"); setMsg(""); $("#camPlaceholder", root).hidden = false; }
      }

      function onState(st) {
        const s = store.getSettings();
        const conf = Math.round((st.conf || 0) * 100);
        $("#confOut", root).textContent = conf + "%";
        $("#confBar", root).style.width = conf + "%";
        $("#detStatus", root).textContent = st.handVisible ? "Hand detected" : "No hand detected";
        const hb = $("#handBadge", root);
        hb.textContent = "Hand: " + (st.handVisible ? "detected" : "none");
        hb.className = "badge " + (st.handVisible ? "good" : "warn");
        if (st.frame) { recentFrames.push(st.frame); if (recentFrames.length > 12) recentFrames.shift(); }
        else recentFrames.length = 0;

        if (st.sign) {
          const sign = store.getSign(st.sign);
          $("#signOut", root).textContent = sign ? sign.name : "…";
          $("#meaningOut", root).textContent = sign ? sign.meaning : "—";
        } else {
          $("#signOut", root).textContent = "…";
          $("#meaningOut", root).textContent = "—";
        }

        // low-confidence handling (never auto-speak a guess)
        const low = st.handVisible && !st.sign && st.raw && st.raw.label && st.raw.conf > 0.25;
        lastRaw = st.raw || null;
        const box = $("#lowConf", root);
        box.hidden = !low;
        if (low) $("#confirmGuess", root).textContent = st.raw.name || "…";

        // dwell -> commit
        if (st.sign) {
          if (st.sign === pending) dwell++; else { pending = st.sign; dwell = 1; }
          if (dwell >= s.dwell && st.sign !== lastCommitted) {
            const sign = store.getSign(st.sign);
            const word = sign?.voiceText || sign?.name || "";
            sentence += (sentence && !sentence.endsWith(" ") ? " " : "") + word;
            setTranscript();
            lastCommitted = st.sign;
            store.addHistory({ signId: st.sign, signName: sign?.name || "", text: word, confidence: st.conf });
            if (s.autoSpeak && speechAvailable() && st.conf >= 0.75) speak(word, { rate: s.voiceRate, lang: s.voiceLang });
          }
        } else {
          pending = null; dwell = 0;
          if (!st.handVisible) lastCommitted = null;
        }
      }

      async function start() {
        try {
          $("#startBtn", root).disabled = true;
          session = session || new LiveSession({ video, canvas, onState, onStatus });
          session.rec.reload();
          await session.start(facing);
          $("#stopBtn", root).disabled = false; $("#flipBtn", root).disabled = false;
        } catch (e) {
          setMsg("Camera error: " + e.message + " — the camera needs HTTPS and your permission.");
          setCam(false, "Camera off");
        } finally { $("#startBtn", root).disabled = false; }
      }

      $("#startBtn", root).onclick = start;
      $("#stopBtn", root).onclick = () => { session?.stop(); $("#stopBtn", root).disabled = true; $("#flipBtn", root).disabled = true; };
      $("#flipBtn", root).onclick = () => { facing = facing === "user" ? "environment" : "user"; session?.setFacing(facing); };
      $("#speakBtn", root).onclick = () => { const t = sentence.trim(); if (t) speak(t, { rate: store.getSettings().voiceRate, lang: store.getSettings().voiceLang }); else toast("Nothing to speak yet"); };
      $("#copyBtn", root).onclick = () => copyText(sentence.trim() || "");
      $("#spaceBtn", root).onclick = () => { sentence += " "; setTranscript(); };
      $("#clearBtn", root).onclick = () => { sentence = ""; lastCommitted = null; setTranscript(); };
      $("#confirmBtn", root).onclick = () => {
        if (!lastRaw || !lastRaw.label) return;
        const sign = store.getSign(lastRaw.label);
        const word = sign?.voiceText || lastRaw.name;
        sentence += (sentence && !sentence.endsWith(" ") ? " " : "") + word;
        setTranscript(); lastCommitted = lastRaw.label;
        store.addHistory({ signId: lastRaw.label, signName: lastRaw.name, text: word, confidence: lastRaw.conf });
        speak(word, { rate: store.getSettings().voiceRate, lang: store.getSettings().voiceLang });
      };

      function updateTaught() {
        const taught = store.trainedSigns().length;
        const tb = $("#taughtBadge", root);
        if (!tb) return;
        tb.textContent = "Signs taught: " + taught;
        tb.className = "badge " + (taught ? "good" : "warn");
      }

      $("#teachBtn", root).onclick = () => {
        const name = $("#teachName", root).value.trim().toUpperCase();
        const msg = $("#teachMsg", root);
        if (!name) { msg.textContent = "Type a sign name first (for example HELLO)."; return; }
        if (recentFrames.length < 3) { msg.textContent = "Hold your hand in view, then tap Capture."; return; }
        const n = recentFrames.length;
        const mean = new Float32Array(63);
        for (const f of recentFrames) for (let i = 0; i < 63; i++) mean[i] += f[i] / n;
        let sign = store.getSigns().find(s => s.name.toUpperCase() === name);
        if (!sign) sign = store.addSign({ name, meaning: name, category: "Common Conversations", voiceText: name, type: "static" });
        store.addSample(sign.id, Array.from(mean), "static");
        if (session) session.rec.reload();
        updateTaught();
        const count = store.getSign(sign.id).samples.length;
        msg.textContent = `Captured sample ${count} for ${name}. Keep holding it and tap again, or teach another sign.`;
        toast(`Sample ${count} saved for ${name}`, "good");
      };

      setCam(false, "Camera off");
      updateTaught();
      if (!store.trainedSigns().length) {
        setMsg("No signs taught yet — use “Teach a sign” on the right, or Admin → Train New Sign.");
      }
      return () => { try { session?.stop(); } catch {} stopSpeech(); };
    },
  };
}

/* ====================================================================== */
/* 3. Sign library                                                        */
/* ====================================================================== */

export function library() {
  const signs = store.getSigns();
  return {
    title: "Sign Library — SignBridge AI",
    html: `
    <div class="wrap section tight">
      <h1>Sign library</h1>
      <p class="muted">Browse signs by category, search by name or meaning, and practise any of them.</p>
      <div class="card" style="margin:16px 0">
        <label class="field" style="margin:0">
          <span>Search signs</span>
          <input type="search" id="q" placeholder="Search signs… e.g. hello, family, food" autocomplete="off">
        </label>
        <div class="chips" id="cats" style="margin-top:14px">
          <button class="chip" data-cat="" aria-pressed="true">All</button>
          ${CATEGORIES.map(c => `<button class="chip" data-cat="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("")}
        </div>
      </div>
      <p class="small muted" id="count"></p>
      <div class="grid cols-3" id="grid" style="margin-top:10px"></div>
    </div>`,
    mount(root) {
      let cat = "", q = "";
      const render = () => {
        const list = store.getSigns().filter(s => {
          const okC = !cat || s.category === cat;
          const t = (s.name + " " + s.meaning + " " + (s.example || "")).toLowerCase();
          return okC && (!q || t.includes(q));
        });
        $("#grid", root).innerHTML = list.length
          ? list.map(signCard).join("")
          : `<div class="empty card" style="grid-column:1/-1"><div class="big" aria-hidden="true">🔍</div>
             <p>No signs match your search.</p></div>`;
        $("#count", root).textContent = `${list.length} sign${list.length === 1 ? "" : "s"} shown of ${store.getSigns().length}.`;
      };
      $("#q", root).addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); render(); });
      $$("#cats .chip", root).forEach(b => b.onclick = () => {
        cat = b.dataset.cat;
        $$("#cats .chip", root).forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        render();
      });
      render();
    },
  };
}

/* ====================================================================== */
/* 4. Practice mode                                                       */
/* ====================================================================== */

export function practice(params) {
  const taught = store.trainedSigns();
  const selId = params?.sign;
  return {
    title: "Practice — SignBridge AI",
    html: `
    <div class="wrap section tight">
      <h1>Practice mode</h1>
      <p class="muted">Learn signs with instant feedback. The AI compares your gesture with the target.</p>

      ${taught.length === 0 ? `
        <div class="empty card" style="margin-top:20px">
          <div class="big" aria-hidden="true">🎯</div>
          <h3>No taught signs yet</h3>
          <p>Practice compares your gesture against signs that have samples. Teach a few first.</p>
          <a class="btn" href="#/admin/signs">Go to Train New Sign</a>
        </div>` : `
      <div class="grid live-grid" style="grid-template-columns:1.3fr 1fr;align-items:start;margin-top:18px">
        <div class="card pad-sm">
          <div class="stage">
            <video id="cam" playsinline autoplay muted aria-label="Camera preview"></video>
            <canvas id="overlay" aria-hidden="true"></canvas>
            <div class="corner"><span class="badge" id="camStatus"><span class="dot off"></span> Camera off</span>
            <span class="badge" id="detStatus">No hand detected</span></div>
            <div class="placeholder" id="camPlaceholder"><div><div style="font-size:2.4rem" aria-hidden="true">🎥</div>
            <p>Tap <strong>Start practice</strong> and allow camera access.</p></div></div>
          </div>
          <div class="btn-row" style="margin-top:12px">
            <button class="btn" id="startBtn">Start practice</button>
            <button class="btn secondary" id="stopBtn" disabled>Stop</button>
          </div>
          <p class="field-hint" id="msg" role="status"></p>
        </div>

        <div class="stack">
          <div class="card">
            <label class="field" style="margin:0"><span>Target sign</span>
              <select id="target">
                ${taught.map(s => `<option value="${esc(s.id)}" ${s.id === selId ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
              </select></label>
            <div class="readout" style="margin-top:14px;text-align:center">
              <div class="small muted">Now perform the sign</div>
              <div class="val sign" id="targetName">—</div>
              <div class="small muted" id="targetMeaning"></div>
            </div>
          </div>

          <div class="readout">
            <div class="spread"><span class="small muted">Recognition</span><strong id="pct">0%</strong></div>
            <div class="meter" style="margin-top:6px"><i id="bar"></i></div>
            <p id="feedback" class="notice info" style="margin-top:12px">Waiting for your hand…</p>
          </div>

          <div class="card">
            <div class="spread"><strong>Your progress</strong><span class="small muted" id="progLabel"></span></div>
            <div class="meter" style="margin-top:8px"><i id="progBar"></i></div>
          </div>
        </div>
      </div>`}
    </div>`,
    mount(root) {
      if (taught.length === 0) return;
      const video = $("#cam", root), canvas = $("#overlay", root);
      let session = null;
      const targetSel = $("#target", root);
      const showTarget = () => {
        const s = store.getSign(targetSel.value);
        $("#targetName", root).textContent = s?.name || "—";
        $("#targetMeaning", root).textContent = s?.meaning || "";
      };
      targetSel.onchange = showTarget; showTarget();

      const updateProgress = () => {
        const p = store.getProgress();
        const learned = p.filter(x => x.best >= 0.75).length;
        $("#progLabel", root).textContent = `Signs learned: ${learned} / ${taught.length}`;
        $("#progBar", root).style.width = Math.round((learned / taught.length) * 100) + "%";
      };
      updateProgress();

      function onStatus(s) {
        if (s.phase === "loading" || s.phase === "camera") $("#msg", root).textContent = s.message;
        if (s.phase === "live") { $("#msg", root).textContent = ""; $("#camPlaceholder", root).hidden = true;
          $("#camStatus", root).innerHTML = `<span class="dot live"></span> Camera live`; }
        if (s.phase === "stopped") { $("#camPlaceholder", root).hidden = false;
          $("#camStatus", root).innerHTML = `<span class="dot off"></span> Camera off`; }
      }

      let best = 0;
      function onState(st) {
        $("#detStatus", root).textContent = st.handVisible ? "Hand detected" : "No hand detected";
        const conf = Math.round((st.conf || 0) * 100);
        $("#pct", root).textContent = conf + "%";
        $("#bar", root).style.width = conf + "%";
        const fb = $("#feedback", root);
        if (!st.handVisible) { fb.className = "notice warn"; fb.textContent = "Move your hand into the camera frame."; return; }
        if (st.sign === targetSel.value) {
          best = Math.max(best, st.conf);
          if (st.conf >= 0.85) { fb.className = "notice good"; fb.textContent = "Excellent! That's the sign."; }
          else if (st.conf >= 0.7) { fb.className = "notice good"; fb.textContent = "Good attempt — hold it a little steadier."; }
          else { fb.className = "notice info"; fb.textContent = "Getting close. Adjust your hand position."; }
        } else if (st.sign) {
          fb.className = "notice warn"; fb.textContent = "That looked like a different sign. Try again.";
        } else {
          fb.className = "notice info"; fb.textContent = "Low confidence — move closer to the camera and hold the sign.";
        }
      }

      async function start() {
        try {
          $("#startBtn", root).disabled = true;
          session = session || new LiveSession({ video, canvas, onState, onStatus });
          session.rec.reload();
          await session.start();
          $("#stopBtn", root).disabled = false;
        } catch (e) { $("#msg", root).textContent = "Camera error: " + e.message; }
        finally { $("#startBtn", root).disabled = false; }
      }
      $("#startBtn", root).onclick = start;
      $("#stopBtn", root).onclick = () => {
        if (best > 0) { store.markPracticed(targetSel.value, best); updateProgress(); toast("Progress saved", "good"); best = 0; }
        session?.stop(); $("#stopBtn", root).disabled = true;
      };
      return () => { try { session?.stop(); } catch {} };
    },
  };
}

/* ====================================================================== */
/* 5. Communication history                                               */
/* ====================================================================== */

export function history() {
  return {
    title: "Communication History — SignBridge AI",
    html: `
    <div class="wrap section tight">
      <div class="spread"><div><h1 style="margin:0">Communication history</h1>
      <p class="muted" style="margin:4px 0 0">Recognised phrases, saved on this device.</p></div>
      <div class="btn-row"><button class="btn secondary" id="exportBtn">Export</button>
      <button class="btn danger" id="clearBtn">Clear all</button></div></div>
      <div style="margin-top:18px" id="body"></div>
    </div>`,
    mount(root) {
      const render = () => {
        const h = store.getHistory();
        $("#body", root).innerHTML = h.length === 0
          ? `<div class="empty card"><div class="big" aria-hidden="true">🗒️</div><h3>No history yet</h3>
             <p>Recognised signs will appear here.</p><a class="btn" href="#/live">Go to Live communication</a></div>`
          : `<div class="table-wrap"><table>
              <caption class="sr-only">Recognised signs with time, text and confidence</caption>
              <thead><tr><th scope="col">Time</th><th scope="col">Detected sign</th><th scope="col">Text</th>
              <th scope="col">Confidence</th><th scope="col">Actions</th></tr></thead>
              <tbody>${h.map(r => `<tr>
                <td>${esc(fmtDateTime(r.ts))}</td>
                <td><strong>${esc(r.signName || "—")}</strong></td>
                <td>${esc(r.text || "")}</td>
                <td>${Math.round((r.confidence || 0) * 100)}%</td>
                <td><div class="btn-row" style="gap:6px">
                  <button class="btn ghost sm" data-speak="${esc(r.text)}">Replay</button>
                  <button class="btn ghost sm" data-copy="${esc(r.text)}">Copy</button>
                  <button class="btn ghost sm" data-del="${esc(r.id)}">Delete</button>
                </div></td></tr>`).join("")}</tbody></table></div>`;
        $$("[data-speak]", root).forEach(b => b.onclick = () => speak(b.dataset.speak, { rate: store.getSettings().voiceRate, lang: store.getSettings().voiceLang }));
        $$("[data-copy]", root).forEach(b => b.onclick = () => copyText(b.dataset.copy));
        $$("[data-del]", root).forEach(b => b.onclick = () => { store.deleteHistory(b.dataset.del); render(); });
      };
      $("#clearBtn", root).onclick = () => { if (confirm("Delete all communication history?")) { store.clearHistory(); render(); toast("History cleared"); } };
      $("#exportBtn", root).onclick = () => download("signbridge-history.json", JSON.stringify(store.getHistory(), null, 2));
      render();
    },
  };
}

/* ====================================================================== */
/* 6. Admin                                                               */
/* ====================================================================== */

const ADMIN_NAV = [
  ["", "Dashboard", "📊"], ["live", "Live Recognition", "🎥"], ["signs", "Train New Sign", "➕"],
  ["dataset", "Dataset", "📦"], ["training", "AI Training", "🧠"], ["library", "Sign Library", "📚"],
  ["users", "Users", "👥"], ["analytics", "Analytics", "📈"], ["settings", "Settings", "⚙️"],
];

export function admin(params) {
  const section = params?.section || "";
  if (!store.isAdmin()) {
    return {
      title: "Admin — SignBridge AI",
      html: `
      <div class="wrap section tight" style="max-width:520px">
        <div class="card">
          <h1 style="margin-top:0">Admin sign-in</h1>
          <div class="notice warn"><strong>Prototype authentication.</strong> This gate runs entirely in
          your browser and is <em>not</em> real security. A production build must use server-side
          authentication with hashed passwords. No default password is hard-coded.</div>
          ${store.hasAdminPass() ? `
            <label class="field"><span>Admin passphrase</span>
              <input type="password" id="pass" autocomplete="current-password"></label>
            <button class="btn block" id="loginBtn">Sign in</button>
            <p class="field-hint">Forgot it? You can reset the passphrase below (this clears the admin gate only).</p>
            <button class="btn ghost sm" id="resetBtn">Reset passphrase</button>
          ` : `
            <p class="muted">First time here — set an admin passphrase for this browser.</p>
            <label class="field"><span>Create admin passphrase</span>
              <input type="password" id="pass" autocomplete="new-password"></label>
            <label class="field"><span>Confirm passphrase</span>
              <input type="password" id="pass2" autocomplete="new-password"></label>
            <button class="btn block" id="setBtn">Set passphrase &amp; enter</button>
          `}
        </div>
      </div>`,
      mount(root) {
        const p = () => $("#pass", root).value;
        if (store.hasAdminPass()) {
          $("#loginBtn", root).onclick = () => {
            if (store.checkAdminPass(p())) { store.setAdmin(true); location.hash = "#/admin"; toast("Signed in", "good"); }
            else toast("Incorrect passphrase", "bad");
          };
          $("#resetBtn", root).onclick = () => { store.data.adminPass = null; store.data.isAdmin = false; store._save(); toast("Passphrase reset — set a new one"); location.reload(); };
        } else {
          $("#setBtn", root).onclick = () => {
            const a = p(), b = $("#pass2", root).value;
            if (a.length < 4) return toast("Use at least 4 characters", "bad");
            if (a !== b) return toast("Passphrases do not match", "bad");
            store.setAdminPass(a); toast("Passphrase set", "good"); location.hash = "#/admin";
          };
        }
      },
    };
  }

  return {
    title: "Admin — SignBridge AI",
    html: `
    <div class="wrap section tight">
      <div class="admin">
        <nav class="side" aria-label="Admin sections">
          ${ADMIN_NAV.map(([k, label, icon]) =>
            `<a href="#/admin${k ? "/" + k : ""}" ${k === section ? 'aria-current="page"' : ""}>
              <span aria-hidden="true">${icon}</span> ${esc(label)}</a>`).join("")}
          <a href="#" id="logout"><span aria-hidden="true">↩️</span> Logout</a>
        </nav>
        <div id="apanel"></div>
      </div>
    </div>`,
    mount(root) {
      $("#logout", root).onclick = (e) => { e.preventDefault(); store.setAdmin(false); toast("Signed out"); location.hash = "#/"; };
      const host = $("#apanel", root);
      const renderers = { "": adminDashboard, live: adminLive, signs: adminSigns, dataset: adminDataset,
                          training: adminTraining, library: adminLibrary, users: adminUsers, analytics: adminAnalytics, settings: adminSettings };
      (renderers[section] || adminDashboard)(host);
    },
  };
}

function adminDashboard(host) {
  const st = store.stats();
  const recent = store.getSigns().slice(0, 5);
  const log = store.getLog().slice(0, 6);
  host.innerHTML = `
    <h1 style="margin-top:0">Dashboard</h1>
    <div class="grid cols-4">
      ${statCard("✋", st.totalSigns, "Total signs")}
      ${statCard("📦", st.totalSamples, "Training samples")}
      ${statCard("💬", st.recognitionsToday, "Recognitions today")}
      ${statCard("🎯", st.trained, "Signs taught")}
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card"><h3>Recently added signs</h3>
        ${recent.length ? `<ul style="margin:0;padding-left:18px">${recent.map(s =>
          `<li>${esc(s.name)} <span class="muted small">· ${esc(s.category)}</span></li>`).join("")}</ul>` : `<p class="muted">None yet.</p>`}
      </div>
      <div class="card"><h3>Activity</h3>
        ${log.length ? `<ul style="margin:0;padding-left:18px">${log.map(l =>
          `<li>${esc(l.msg)} <span class="muted small">· ${esc(relTime(l.ts))}</span></li>`).join("")}</ul>` : `<p class="muted">No activity yet.</p>`}
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <div class="spread"><div><h3 style="margin:0">Recognition readiness</h3>
      <p class="muted small" style="margin:4px 0 0">${st.trained} of ${st.totalSigns} signs have training samples.</p></div>
      <a class="btn" href="#/admin/signs">Train a new sign</a></div>
      <div class="meter" style="margin-top:12px"><i style="width:${Math.round((st.trained / Math.max(1, st.totalSigns)) * 100)}%"></i></div>
    </div>`;
}

function adminLive(host) {
  host.innerHTML = `<div class="card"><h1 style="margin-top:0">Live recognition</h1>
    <p class="muted">The live view is shared with the public app so behaviour stays identical.</p>
    <a class="btn" href="#/live">Open live communication</a></div>`;
}

function adminSigns(host) {
  host.innerHTML = `
    <h1 style="margin-top:0">Train a new sign</h1>
    <div class="grid cols-2">
      <div class="card">
        <h3>1 · Sign details</h3>
        <div class="form-grid">
          <label class="field"><span>Sign name</span><input type="text" id="f-name" placeholder="e.g. HELLO"></label>
          <label class="field"><span>Meaning</span><input type="text" id="f-meaning" placeholder="e.g. Greeting"></label>
          <label class="field"><span>Category</span><select id="f-cat">${CATEGORIES.map(c => `<option>${c}</option>`).join("")}</select></label>
          <label class="field"><span>Difficulty</span><select id="f-diff"><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
          <label class="field"><span>Sign type</span><select id="f-type"><option value="static">Static (one pose)</option><option value="dynamic">Dynamic (movement)</option></select></label>
          <label class="field"><span>Language</span><input type="text" id="f-lang" value="Indian Sign Language"></label>
        </div>
        <label class="field"><span>Example sentence</span><input type="text" id="f-ex" placeholder="e.g. Hello, how are you?"></label>
        <label class="field"><span>Voice output text</span><input type="text" id="f-voice" placeholder="e.g. Hello"></label>
        <label class="field"><span>Description</span><textarea id="f-desc" placeholder="How the sign is performed…"></textarea></label>
        <button class="btn block" id="createBtn">Create sign</button>
      </div>

      <div class="card">
        <h3>2 · Capture training samples</h3>
        <div class="notice info" id="capInfo">Create the sign first, then record samples here.</div>
        <label class="field" style="margin-top:12px"><span>Sign to record</span><select id="capSign"></select></label>
        <div class="stage" style="aspect-ratio:4/3">
          <video id="cam" playsinline autoplay muted aria-label="Camera preview"></video>
          <canvas id="overlay" aria-hidden="true"></canvas>
          <div class="corner"><span class="badge" id="capStatus"><span class="dot off"></span> Camera off</span>
          <span class="badge" id="recDot" hidden><span class="rec-dot"></span> Recording</span></div>
          <div class="placeholder" id="camPlaceholder"><div><div style="font-size:2.2rem" aria-hidden="true">🎥</div>
          <p>Start the camera, then hold the sign and capture samples.</p></div></div>
        </div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn secondary" id="capStart">Start camera</button>
          <button class="btn" id="capSample" disabled>Capture sample</button>
          <button class="btn secondary" id="capBurst" disabled>Capture 10</button>
        </div>
        <div style="margin-top:12px"><div class="spread"><span class="small muted">Samples for this sign</span>
        <strong id="capCount">0 / 20</strong></div><div class="meter" style="margin-top:6px"><i id="capBar"></i></div></div>
        <p class="field-hint">Recommended: 10–20 samples per sign, with varied hand positions, distances and lighting. Keep still for a static sign; perform the full movement for a dynamic sign.</p>
      </div>
    </div>`;

  const capSign = $("#capSign", host);
  const refreshSigns = () => {
    const signs = store.getSigns();
    capSign.innerHTML = signs.length ? signs.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("") : `<option value="">— none yet —</option>`;
    updateCount();
  };
  const updateCount = () => {
    const s = store.getSign(capSign.value);
    const n = s?.samples?.length || 0;
    $("#capCount", host).textContent = `${n} / 20`;
    $("#capBar", host).style.width = Math.min(100, Math.round((n / 20) * 100)) + "%";
  };
  capSign.onchange = updateCount;

  $("#createBtn", host).onclick = () => {
    const name = $("#f-name", host).value.trim();
    if (!name) return toast("Sign name is required", "bad");
    const sign = store.addSign({
      name, meaning: $("#f-meaning", host).value.trim() || name,
      category: $("#f-cat", host).value, difficulty: $("#f-diff", host).value,
      type: $("#f-type", host).value, language: $("#f-lang", host).value.trim(),
      example: $("#f-ex", host).value.trim(), voiceText: $("#f-voice", host).value.trim() || name,
      description: $("#f-desc", host).value.trim(),
    });
    toast(`Sign "${sign.name}" created — now capture samples`, "good");
    ["f-name", "f-meaning", "f-ex", "f-voice", "f-desc"].forEach(id => $("#" + id, host).value = "");
    refreshSigns(); capSign.value = sign.id; updateCount();
  };

  // --- capture session ---
  const video = $("#cam", host), canvas = $("#overlay", host);
  let tracker = null, stream = null, raf = 0, running = false, lastTime = -1, recent = [];
  const drawLoop = () => {
    if (!running) return;
    raf = requestAnimationFrame(drawLoop);
    if (video.readyState < 2 || video.currentTime === lastTime) return;
    lastTime = video.currentTime;
    const lm = tracker.detect(video, performance.now());
    tracker.draw(canvas, video, lm);
    if (lm) { recent.push(toFeatures(lm)); if (recent.length > 12) recent.shift(); }
    else recent = [];
  };
  $("#capStart", host).onclick = async () => {
    try {
      $("#capStart", host).disabled = true;
      $("#capStatus", host).innerHTML = `<span class="dot off"></span> Loading…`;
      tracker = tracker || await getSharedTracker();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      video.srcObject = stream; await video.play();
      running = true; drawLoop();
      $("#camPlaceholder", host).hidden = true;
      $("#capStatus", host).innerHTML = `<span class="dot live"></span> Camera live`;
      $("#capSample", host).disabled = false; $("#capBurst", host).disabled = false;
    } catch (e) { $("#capStatus", host).innerHTML = `<span class="dot off"></span> ${esc(e.message)}`; }
    finally { $("#capStart", host).disabled = false; }
  };
  const captureOne = () => {
    if (recent.length === 0) { toast("No hand detected — hold your hand in view", "bad"); return false; }
    const n = recent.length, mean = new Float32Array(63);
    for (const f of recent) for (let i = 0; i < 63; i++) mean[i] += f[i] / n;
    const s = store.getSign(capSign.value);
    store.addSample(capSign.value, Array.from(mean), s?.type === "dynamic" ? "dynamic" : "static");
    return true;
  };
  $("#capSample", host).onclick = () => { if (captureOne()) { updateCount(); flashRec(); } };
  $("#capBurst", host).onclick = () => {
    let n = 0;
    const t = setInterval(() => { if (captureOne()) { n++; updateCount(); } if (n >= 10) clearInterval(t); }, 220);
    flashRec();
  };
  function flashRec() { const d = $("#recDot", host); d.hidden = false; setTimeout(() => d.hidden = true, 500); }

  refreshSigns();
  return () => { running = false; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach(t => t.stop()); };
}

function adminDataset(host) {
  const render = () => {
    const signs = store.getSigns().filter(s => (s.samples?.length || 0) > 0);
    host.innerHTML = `
      <div class="spread"><h1 style="margin:0">Dataset</h1>
      <div class="btn-row"><button class="btn secondary" id="exp">Export dataset</button></div></div>
      <p class="muted">Manage captured samples. Delete incorrect or low-quality samples so the recogniser stays accurate.</p>
      ${signs.length === 0 ? `<div class="empty card"><div class="big" aria-hidden="true">📦</div><h3>No samples yet</h3>
        <p>Capture samples in Train New Sign.</p><a class="btn" href="#/admin/signs">Train a sign</a></div>`
      : signs.map(s => `
        <div class="card" style="margin-bottom:14px">
          <div class="spread"><div><h3 style="margin:0">${esc(s.name)} <span class="badge info">${esc(s.type)}</span></h3>
          <p class="muted small" style="margin:4px 0 0">${esc(s.meaning)} · ${s.samples.length} samples</p></div>
          <button class="btn danger sm" data-clear="${esc(s.id)}">Delete all</button></div>
          <div class="chips" style="margin-top:10px">
            ${s.samples.map((x, i) => `<span class="chip">#${i + 1}
              <button class="btn ghost sm" style="padding:0 4px" data-del="${esc(s.id)}|${esc(x.id)}" aria-label="Delete sample ${i + 1}">✕</button></span>`).join("")}
          </div>
        </div>`).join("")}`;
    $$("[data-del]", host).forEach(b => b.onclick = () => { const [sid, xid] = b.dataset.del.split("|"); store.deleteSample(sid, xid); render(); });
    $$("[data-clear]", host).forEach(b => b.onclick = () => {
      if (!confirm("Delete every sample for this sign?")) return;
      const s = store.getSign(b.dataset.clear); s.samples = []; store._save(); render();
    });
    const e = $("#exp", host); if (e) e.onclick = () => download("signbridge-dataset.json",
      JSON.stringify(store.getSigns().map(s => ({ name: s.name, type: s.type, samples: s.samples.length })), null, 2));
  };
  render();
}

function adminTraining(host) {
  const rec = new Recognizer(); rec.reload();
  const acc = rec.crossValidate();
  const st = store.stats();
  host.innerHTML = `
    <div class="spread"><h1 style="margin:0">AI training</h1>
    <span class="badge warn">Prototype training mode</span></div>
    <div class="notice warn"><strong>Prototype training mode.</strong> No neural network is trained here,
    and no epoch/loss curve is fabricated. This screen reports the <em>real</em> state of the
    recognition engine: the classifier is built from the samples you captured, and the accuracy below
    is a genuine leave-one-out cross-validation over those samples. The architecture keeps the model
    separate so a full ML pipeline can replace it later without touching the UI.</div>

    <div class="grid cols-3" style="margin-top:16px">
      ${statCard("📦", st.totalSamples, "Total samples")}
      ${statCard("✋", st.trained, "Signs with samples")}
      ${statCard("🎯", acc === null ? "—" : Math.round(acc * 100) + "%", "Cross-validated accuracy")}
    </div>

    <div class="grid cols-2" style="margin-top:16px">
      <div class="card">
        <h3>Model status</h3>
        <p class="muted small">Classifier: k-nearest-neighbours over hand-landmark features (in-browser).</p>
        <div class="spread"><span class="small muted">Status</span>
        <span class="badge ${acc === null ? "warn" : "good"}">${acc === null ? "Needs more samples" : "Ready"}</span></div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn" id="buildBtn">Rebuild classifier</button>
          <button class="btn secondary" id="testBtn">Test model</button>
        </div>
        <p class="field-hint">“Rebuild” re-indexes your latest samples. “Test” opens live recognition to try it.</p>
      </div>
      <div class="card">
        <h3>Samples per sign</h3>
        ${store.getSigns().filter(s => s.samples.length).length === 0 ? `<p class="muted">No samples captured yet.</p>` :
          `<div class="bars">${store.getSigns().filter(s => s.samples.length).slice(0, 8).map(s => {
            const h = Math.min(100, (s.samples.length / 20) * 100);
            return `<div class="b" style="height:${Math.max(4, h)}%"><span>${s.samples.length}</span><em>${esc(s.name.slice(0, 6))}</em></div>`;
          }).join("")}</div>`}
      </div>
    </div>`;

  $("#buildBtn", host).onclick = () => { rec.reload(); toast("Classifier rebuilt from current samples", "good"); adminTraining(host); };
  $("#testBtn", host).onclick = () => location.hash = "#/live";
}

function adminLibrary(host) {
  const render = () => {
    host.innerHTML = `<div class="spread"><h1 style="margin:0">Manage signs</h1>
      <a class="btn" href="#/admin/signs">➕ Add sign</a></div>
      <p class="muted">Edit or remove signs from the library.</p>
      <div class="table-wrap"><table><thead><tr><th scope="col">Sign</th><th scope="col">Category</th>
      <th scope="col">Type</th><th scope="col">Samples</th><th scope="col">Actions</th></tr></thead><tbody>
      ${store.getSigns().map(s => `<tr><td><strong>${esc(s.name)}</strong><div class="muted small">${esc(s.meaning)}</div></td>
        <td>${esc(s.category)}</td><td>${esc(s.type)}</td><td>${s.samples.length}</td>
        <td><button class="btn ghost sm" data-del="${esc(s.id)}">Delete</button></td></tr>`).join("")}
      </tbody></table></div>`;
    $$("[data-del]", host).forEach(b => b.onclick = () => {
      if (confirm("Delete this sign and its samples?")) { store.deleteSign(b.dataset.del); render(); }
    });
  };
  render();
}

function adminUsers(host) {
  host.innerHTML = `<h1 style="margin-top:0">Users</h1>
    <div class="notice warn">Prototype data only — user accounts are illustrative. Real deployments use
    server-side accounts with hashed passwords and role-based access control.</div>
    <div class="table-wrap" style="margin-top:14px"><table><thead><tr><th scope="col">Name</th>
    <th scope="col">Email</th><th scope="col">Role</th></tr></thead><tbody>
    ${store.data.users.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td>
      <td><span class="badge ${u.role === "admin" ? "info" : ""}">${esc(u.role)}</span></td></tr>`).join("")}
    </tbody></table></div>`;
}

function adminAnalytics(host) {
  const h = store.getHistory();
  const bySign = {};
  h.forEach(r => { const k = r.signName || "Unknown"; bySign[k] = (bySign[k] || 0) + 1; });
  const top = Object.entries(bySign).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = Math.max(1, ...top.map(t => t[1]));
  const avgConf = h.length ? h.reduce((n, r) => n + (r.confidence || 0), 0) / h.length : 0;
  host.innerHTML = `
    <h1 style="margin-top:0">Analytics</h1>
    <div class="grid cols-3">
      ${statCard("💬", h.length, "Total recognitions")}
      ${statCard("📈", Math.round(avgConf * 100) + "%", "Average confidence")}
      ${statCard("✋", Object.keys(bySign).length, "Distinct signs recognised")}
    </div>
    <div class="card" style="margin-top:16px"><h3>Recognitions by sign</h3>
      ${top.length === 0 ? `<p class="muted">No recognitions recorded yet.</p>` :
        `<div class="bars">${top.map(([k, v]) => `<div class="b" style="height:${Math.max(6, (v / max) * 100)}%">
          <span>${v}</span><em>${esc(k.slice(0, 8))}</em></div>`).join("")}</div>`}
    </div>`;
}

function adminSettings(host) {
  const s = store.getSettings();
  const render = () => {
    const c = store.getSettings();
    host.innerHTML = `
      <h1 style="margin-top:0">Settings</h1>
      <div class="grid cols-2">
        <div class="card"><h3>Recognition</h3>
          <label class="field"><span>Confidence threshold: <output id="tv">${Math.round(c.threshold * 100)}%</output></span>
            <input type="range" id="threshold" min="30" max="95" value="${Math.round(c.threshold * 100)}"></label>
          <label class="field"><span>Smoothing window (frames): <output id="sv">${c.smoothing}</output></span>
            <input type="range" id="smoothing" min="4" max="30" value="${c.smoothing}"></label>
          <label class="field"><span>Dwell (frames before typing): <output id="dv">${c.dwell}</output></span>
            <input type="range" id="dwell" min="3" max="30" value="${c.dwell}"></label>
          <p class="field-hint">Lower the threshold to recognise more readily; raise it to avoid wrong guesses.</p>
        </div>
        <div class="card"><h3>Speech</h3>
          <label class="field"><span>Speak recognised signs automatically</span>
            <input type="checkbox" id="auto" ${c.autoSpeak ? "checked" : ""} style="width:auto"></label>
          <label class="field"><span>Voice rate: <output id="rv">${c.voiceRate}</output></span>
            <input type="range" id="rate" min="50" max="150" value="${Math.round(c.voiceRate * 100)}"></label>
          <label class="field"><span>Language</span>
            <select id="lang">${["en-IN", "en-US", "en-GB", "hi-IN", "ta-IN", "te-IN", "ml-IN", "bn-IN"]
              .map(l => `<option ${l === c.voiceLang ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <button class="btn secondary" id="testVoice">Test voice</button>
        </div>
      </div>
      <div class="card" style="margin-top:16px"><h3>Data</h3>
        <p class="muted small">All data lives in this browser only.</p>
        <div class="btn-row">
          <button class="btn secondary" id="expAll">Export all data</button>
          <button class="btn danger" id="resetAll">Reset everything</button>
        </div>
      </div>`;
    const bind = (id, key, scale = 1, out = null) => {
      const e = $("#" + id, host);
      e.oninput = () => {
        const v = scale === 1 ? Number(e.value) : Number(e.value) / 100;
        store.setSettings({ [key]: scale === 1 ? Number(e.value) : v });
        if (out) $("#" + out, host).textContent = scale === 1 ? e.value : Math.round(v * 100) + "%";
      };
    };
    bind("threshold", "threshold", 100, "tv");
    bind("smoothing", "smoothing", 1, "sv");
    bind("dwell", "dwell", 1, "dv");
    bind("rate", "voiceRate", 100, "rv");
    $("#auto", host).onchange = e => store.setSettings({ autoSpeak: e.target.checked });
    $("#lang", host).onchange = e => store.setSettings({ voiceLang: e.target.value });
    $("#testVoice", host).onclick = () => speak("This is the SignBridge AI voice.", { rate: store.getSettings().voiceRate, lang: store.getSettings().voiceLang });
    $("#expAll", host).onclick = () => download("signbridge-data.json", store.export());
    $("#resetAll", host).onclick = () => { if (confirm("Reset ALL data (signs, samples, history, settings)?")) { store.resetAll(); toast("All data reset"); location.hash = "#/"; location.reload(); } };
  };
  render();
}

export const views = { landing, live, library, practice, history, admin };
