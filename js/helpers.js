/* ==========================================================================
   helpers.js — tiny DOM, text, speech and formatting utilities.
   ========================================================================== */

/* Escape untrusted text before putting it into innerHTML templates. */
export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/* Build an element from an HTML string. */
export function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/* Shortcut: query within a root. */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ---------------- toasts ---------------- */
export function toast(msg, kind = "") {
  const box = document.getElementById("toasts");
  if (!box) return;
  const t = el(`<div class="toast ${kind}" role="status">${esc(msg)}</div>`);
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; }, 2600);
  setTimeout(() => t.remove(), 3000);
}

/* ---------------- speech (Web Speech API) ---------------- */
let current = null;

export function speechAvailable() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text, { rate = 0.95, lang = "en-IN" } = {}) {
  if (!speechAvailable() || !text) return null;
  try { window.speechSynthesis.cancel(); } catch { /* noop */ }
  const u = new SpeechSynthesisUtterance(text);
  u.rate = rate; u.lang = lang;
  const voices = window.speechSynthesis.getVoices?.() || [];
  const pick = voices.find(v => v.lang === lang) || voices.find(v => v.lang?.startsWith("en"));
  if (pick) u.voice = pick;
  current = u;
  window.speechSynthesis.speak(u);
  return u;
}

export function pauseSpeech() { try { window.speechSynthesis.pause(); } catch { /* noop */ } }
export function resumeSpeech() { try { window.speechSynthesis.resume(); } catch { /* noop */ } }
export function stopSpeech() { try { window.speechSynthesis.cancel(); } catch { /* noop */ } }
export function isSpeaking() { try { return window.speechSynthesis.speaking; } catch { return false; } }

/* ---------------- formatting ---------------- */
export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
export function fmtDateTime(ts) {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}
export function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60); if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

/* ---------------- clipboard ---------------- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to clipboard", "good");
    return true;
  } catch {
    toast("Could not copy — select the text manually", "bad");
    return false;
  }
}

/* ---------------- download ---------------- */
export function download(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
