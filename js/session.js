/* ==========================================================================
   session.js — one live camera + recognition session.
   Shared by the Live Communication page and Practice mode so the tracking,
   smoothing and config behave identically everywhere.
   ========================================================================== */

import { HandTracker, Recognizer, toFeatures } from "./cv.js";
import { store } from "./store.js";

let trackerPromise = null;
function getTracker() {
  if (!trackerPromise) trackerPromise = HandTracker.create();
  return trackerPromise;
}

/** Shared tracker so the MediaPipe model is loaded only once per session. */
export function getSharedTracker() { return getTracker(); }

export class LiveSession {
  /** @param opts {video, canvas, onState, onStatus} */
  constructor({ video, canvas, onState, onStatus }) {
    this.video = video;
    this.canvas = canvas;
    this.onState = onState || (() => {});
    this.onStatus = onStatus || (() => {});
    this.rec = new Recognizer();
    this.running = false;
    this.stream = null;
    this.seq = [];              // rolling window for dynamic matching
    this.lastTime = -1;
    this.raf = 0;
  }

  async start(facing = "user") {
    this.onStatus({ phase: "loading", message: "Loading hand-tracking model…" });
    const tracker = await getTracker();
    this.tracker = tracker;

    this.onStatus({ phase: "camera", message: "Requesting camera permission…" });
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    this.rec.reload();
    this.running = true;
    this.onStatus({ phase: "live", message: "Live" });
    this._loop();
  }

  setFacing(facing) { this.start(facing); }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    const ctx = this.canvas.getContext("2d");
    ctx && ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.onStatus({ phase: "stopped", message: "Stopped" });
    this.onState({ sign: null, name: "…", meaning: "", conf: 0, handVisible: false });
  }

  _loop() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(() => this._loop());
    const v = this.video;
    if (!v || v.readyState < 2) return;
    if (v.currentTime === this.lastTime) return;
    this.lastTime = v.currentTime;

    const lm = this.tracker.detect(v, performance.now());
    this.tracker.draw(this.canvas, v, lm);

    if (!lm) {
      this.seq = [];
      this.rec.reset();
      this.onState({ sign: null, name: "…", meaning: "", conf: 0, handVisible: false });
      return;
    }
    const f = toFeatures(lm);
    this.seq.push(f);
    if (this.seq.length > 24) this.seq.shift();

    const cfg = store.getSettings();
    const out = this.rec.update(f, this.seq, cfg);
    const raw = this.rec.predictRaw(f, this.seq);
    this.onState({ ...out, raw, frame: f, seq: this.seq.slice() });
  }
}
