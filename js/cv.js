/* ==========================================================================
   cv.js — computer vision + recognition engine (runs fully in the browser).

   Pipeline:  camera frame -> MediaPipe hand landmarks -> feature vector ->
              k-nearest-neighbours over taught samples -> smoothed prediction.

   Static signs  : one 63-number feature vector (21 landmarks x xyz, normalised).
   Dynamic signs : a short sequence resampled to a fixed length (temporal).
   The model is separated from the UI so it can be replaced by a real trained
   model later without touching the rest of the app.
   ========================================================================== */

import { store } from "./store.js";

const CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17],
];

export const SEQ_LEN = 8;      // dynamic gestures are resampled to this length
export const K = 5;            // neighbours

/* ---------------- feature maths ---------------- */

export function toFeatures(lm) {
  const p0 = lm[0];
  let pts = lm.map(p => [p.x - p0.x, p.y - p0.y, p.z - p0.z]);
  let max = 0;
  for (const [x, y, z] of pts) max = Math.max(max, Math.hypot(x, y, z));
  if (max > 1e-6) pts = pts.map(([x, y, z]) => [x / max, y / max, z / max]);
  const out = new Float32Array(63);
  let i = 0;
  for (const [x, y, z] of pts) { out[i++] = x; out[i++] = y; out[i++] = z; }
  return out;
}

/* Resample a sequence of frames to a fixed length (duration-independent). */
export function resampleSequence(seq, n = SEQ_LEN) {
  if (seq.length === 0) return null;
  if (seq.length === 1) seq = [seq[0], seq[0]];
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (seq.length - 1);
    const lo = Math.floor(t), hi = Math.min(seq.length - 1, lo + 1), f = t - lo;
    const a = seq[lo], b = seq[hi];
    const v = new Float32Array(63);
    for (let j = 0; j < 63; j++) v[j] = a[j] * (1 - f) + b[j] * f;
    out.push(v);
  }
  return out;
}

export function flattenSequence(seq) {
  const out = new Float32Array(seq.length * 63);
  seq.forEach((v, i) => out.set(v, i * 63));
  return out;
}

function euclid(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}

/* ---------------- hand tracking ---------------- */

export class HandTracker {
  static async create() {
    const { FilesetResolver, HandLandmarker } = await import(CDN);
    const fileset = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    const base = { modelAssetPath: MODEL, delegate: "GPU" };
    const opts = {
      baseOptions: base, runningMode: "VIDEO", numHands: 1,
      minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    };
    let lm;
    try { lm = await HandLandmarker.createFromOptions(fileset, opts); }
    catch { opts.baseOptions = { modelAssetPath: MODEL, delegate: "CPU" }; lm = await HandLandmarker.createFromOptions(fileset, opts); }
    return new HandTracker(lm);
  }
  constructor(landmarker) { this.landmarker = landmarker; }

  detect(video, ts) {
    let res;
    try { res = this.landmarker.detectForVideo(video, ts); } catch { return null; }
    return res?.landmarks?.length ? res.landmarks[0] : null;
  }

  draw(canvas, video, lm) {
    const ctx = canvas.getContext("2d");
    if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lm) return;
    const w = canvas.width, h = canvas.height;
    const px = lm.map(p => [p.x * w, p.y * h]);
    ctx.lineWidth = Math.max(2, w / 260);
    ctx.strokeStyle = "#22d3a6";
    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) { ctx.moveTo(px[a][0], px[a][1]); ctx.lineTo(px[b][0], px[b][1]); }
    ctx.stroke();
    for (const [x, y] of px) { ctx.beginPath(); ctx.arc(x, y, Math.max(3, w / 130), 0, 7); ctx.fill(); }
  }
}

/* ---------------- recogniser ---------------- */

export class Recognizer {
  constructor() {
    this.static = [];     // [{label, name, meaning, f}]
    this.dynamic = [];    // [{label, name, meaning, f}]
    this.history = [];
    this.pending = null;
    this.dwell = 0;
    this.lastCommitted = null;
  }

  /** Rebuild the pools from the current taught signs. */
  reload() {
    this.static = []; this.dynamic = [];
    for (const s of store.getSigns()) {
      for (const sample of s.samples || []) {
        const entry = { label: s.id, name: s.name, meaning: s.meaning, f: sample.f };
        if (sample.type === "dynamic") this.dynamic.push(entry); else this.static.push(entry);
      }
    }
  }

  get taughtCount() { return this.static.length + this.dynamic.length; }

  /** Raw nearest-neighbour prediction. f63 = current static feature,
      dynSeq = rolling sequence (array of Float32Array) for dynamic matching. */
  predictRaw(f63, dynSeq = null) {
    let best = null;
    if (this.static.length && f63) {
      const scored = this.static
        .map(s => ({ ...s, d: euclid(f63, s.f) / 63 }))
        .sort((a, b) => a.d - b.d).slice(0, Math.min(K, this.static.length));
      const votes = {};
      scored.forEach(s => votes[s.label] = (votes[s.label] || 0) + 1);
      let lbl = null, n = 0;
      for (const k in votes) if (votes[k] > n) { n = votes[k]; lbl = k; }
      const top = scored.find(s => s.label === lbl);
      best = { label: lbl, name: top.name, meaning: top.meaning, conf: n / scored.length };
    }
    if (this.dynamic.length && dynSeq && dynSeq.length >= 3) {
      const seq = resampleSequence(dynSeq);
      const fd = flattenSequence(seq);
      const scored = this.dynamic
        .map(s => ({ ...s, d: euclid(fd, s.f) / fd.length }))
        .sort((a, b) => a.d - b.d).slice(0, Math.min(K, this.dynamic.length));
      const votes = {};
      scored.forEach(s => votes[s.label] = (votes[s.label] || 0) + 1);
      let lbl = null, n = 0;
      for (const k in votes) if (votes[k] > n) { n = votes[k]; lbl = k; }
      const top = scored.find(s => s.label === lbl);
      const cand = { label: lbl, name: top.name, meaning: top.meaning, conf: n / scored.length, isDynamic: true };
      if (!best || cand.conf >= best.conf) best = cand;
    }
    return best || { label: null, name: "…", meaning: "", conf: 0 };
  }

  /** Smoothed, dwell-gated prediction used by the live loop. */
  update(f63, dynSeq, cfg) {
    if (!f63) {
      this.history = []; this.pending = null; this.dwell = 0;
      return { sign: null, name: "…", meaning: "", conf: 0, handVisible: false };
    }
    const raw = this.predictRaw(f63, dynSeq);
    this.history.push(raw.label || "none");
    if (this.history.length > cfg.smoothing) this.history.shift();

    const counts = {};
    this.history.forEach(l => counts[l] = (counts[l] || 0) + 1);
    let lbl = null, n = 0;
    for (const k in counts) if (counts[k] > n) { n = counts[k]; lbl = k; }
    const agree = n / this.history.length;

    let out = { sign: null, name: "…", meaning: "", conf: raw.conf, handVisible: true };
    if (lbl && lbl !== "none" && agree >= 0.6 && raw.conf >= cfg.threshold) {
      out = { sign: raw.label, name: raw.name, meaning: raw.meaning, conf: raw.conf, handVisible: true };
    }
    return out;
  }

  reset() { this.history = []; this.pending = null; this.dwell = 0; this.lastCommitted = null; }

  /** Real leave-one-out cross-validation over the taught static samples.
      This is an honest accuracy figure for the current dataset — it is NOT a
      simulated training curve. Returns null when there is too little data. */
  crossValidate() {
    const all = this.static;
    if (all.length < 4) return null;
    let correct = 0;
    for (let i = 0; i < all.length; i++) {
      let best = null, bd = Infinity;
      for (let j = 0; j < all.length; j++) {
        if (i === j) continue;
        const d = euclid(all[i].f, all[j].f);
        if (d < bd) { bd = d; best = all[j]; }
      }
      if (best && best.label === all[i].label) correct++;
    }
    return correct / all.length;
  }
}
