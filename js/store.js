/* ==========================================================================
   store.js — client-side data layer.
   Everything lives in localStorage. This is the PROTOTYPE persistence layer;
   the app is architected so it can be swapped for a real API + database later
   (see README). No camera footage is ever stored here — only landmark numbers.
   ========================================================================== */

const KEY = "signbridge.ai.v2";

export const CATEGORIES = [
  "Greetings", "Numbers", "Alphabets", "Family", "Education",
  "Food", "Emotions", "Daily Activities", "Emergency", "Common Conversations",
];

/* Realistic seed data for the Sign Library. These are library entries only —
   they carry NO recognition samples, so the recogniser stays honest: it only
   ever recognises what someone has actually taught it. */
const SEED_SIGNS = [
  { name: "HELLO",       meaning: "Greeting",          category: "Greetings", difficulty: "Easy",   emoji: "👋", example: "Hello, how are you?",   voiceText: "Hello", type: "static" },
  { name: "THANK YOU",   meaning: "Gratitude",         category: "Greetings", difficulty: "Easy",   emoji: "🙏", example: "Thank you for your help.", voiceText: "Thank you", type: "static" },
  { name: "PLEASE",      meaning: "Polite request",    category: "Common Conversations", difficulty: "Easy", emoji: "🤲", example: "Please sit down.", voiceText: "Please", type: "static" },
  { name: "YES",         meaning: "Agreement",         category: "Common Conversations", difficulty: "Easy", emoji: "👍", example: "Yes, I understand.", voiceText: "Yes", type: "static" },
  { name: "NO",          meaning: "Disagreement",      category: "Common Conversations", difficulty: "Easy", emoji: "👎", example: "No, thank you.", voiceText: "No", type: "static" },
  { name: "SORRY",       meaning: "Apology",           category: "Emotions",  difficulty: "Easy",   emoji: "🙇", example: "Sorry, I did not mean to.", voiceText: "Sorry", type: "static" },
  { name: "HELP",        meaning: "Request assistance",category: "Emergency", difficulty: "Medium", emoji: "🆘", example: "I need help.", voiceText: "I need help", type: "static" },
  { name: "WATER",       meaning: "Drinking water",    category: "Food",      difficulty: "Easy",   emoji: "💧", example: "May I have some water?", voiceText: "Water", type: "static" },
  { name: "FOOD",        meaning: "Something to eat",  category: "Food",      difficulty: "Easy",   emoji: "🍽️", example: "I am hungry.", voiceText: "Food", type: "static" },
  { name: "MOTHER",      meaning: "Mother",            category: "Family",    difficulty: "Easy",   emoji: "👩", example: "This is my mother.", voiceText: "Mother", type: "static" },
  { name: "FATHER",      meaning: "Father",            category: "Family",    difficulty: "Easy",   emoji: "👨", example: "This is my father.", voiceText: "Father", type: "static" },
  { name: "GOOD MORNING",meaning: "Morning greeting",  category: "Greetings", difficulty: "Medium", emoji: "🌅", example: "Good morning, teacher.", voiceText: "Good morning", type: "dynamic" },
  { name: "I LOVE YOU",  meaning: "Affection",         category: "Emotions",  difficulty: "Easy",   emoji: "❤️", example: "I love you.", voiceText: "I love you", type: "static" },
  { name: "TEACHER",     meaning: "Teacher",           category: "Education", difficulty: "Medium", emoji: "🧑‍🏫", example: "The teacher is here.", voiceText: "Teacher", type: "static" },
  { name: "BOOK",        meaning: "Book",              category: "Education", difficulty: "Easy",   emoji: "📘", example: "Please open your book.", voiceText: "Book", type: "static" },
  { name: "HAPPY",       meaning: "Feeling happy",     category: "Emotions",  difficulty: "Easy",   emoji: "😊", example: "I am happy today.", voiceText: "I am happy", type: "static" },
  { name: "SAD",         meaning: "Feeling sad",       category: "Emotions",  difficulty: "Easy",   emoji: "😢", example: "I feel sad.", voiceText: "I am sad", type: "static" },
  { name: "DOCTOR",      meaning: "Medical help",      category: "Emergency", difficulty: "Medium", emoji: "🩺", example: "Please call a doctor.", voiceText: "Doctor", type: "static" },
];

const DEFAULT_SETTINGS = {
  threshold: 0.6,      // below this the app refuses to guess
  smoothing: 12,       // frames in the majority-vote window
  dwell: 10,           // frames a sign must hold before it is typed
  voiceRate: 0.95,
  voiceLang: "en-IN",
  autoSpeak: true,     // speak automatically when confidence is high
};

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/* Prototype-only passphrase hash. NOT cryptographically secure and clearly
   labelled as such in the UI. It exists only to gate the demo admin area on a
   client-side prototype — real deployments must use server-side auth. */
function weakHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return "ph1$" + h.toString(36);
}

const clone = (v) => JSON.parse(JSON.stringify(v));

class Store {
  constructor() { this._load(); }

  _load() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { raw = null; }
    this.data = raw && typeof raw === "object" ? raw : {};
    if (!Array.isArray(this.data.signs)) this.data.signs = SEED_SIGNS.map(s => ({
      id: uid(), samples: [], createdAt: Date.now(), description: "", language: "Indian Sign Language", ...s,
    }));
    if (!Array.isArray(this.data.history)) this.data.history = [];
    if (!Array.isArray(this.data.users)) this.data.users = [
      { id: uid(), name: "Administrator", email: "admin@signbridge.local", role: "admin" },
      { id: uid(), name: "Guest Learner", email: "guest@signbridge.local", role: "user" },
    ];
    if (!Array.isArray(this.data.log)) this.data.log = [];
    if (!this.data.settings) this.data.settings = clone(DEFAULT_SETTINGS);
    if (!Array.isArray(this.data.progress)) this.data.progress = [];
    if (this.data.adminPass === undefined) this.data.adminPass = null;
    if (this.data.isAdmin === undefined) this.data.isAdmin = false;
    this._save();
  }

  _save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* quota */ } }

  /* ---------------- signs ---------------- */
  getSigns() { return this.data.signs; }
  getSign(id) { return this.data.signs.find(s => s.id === id) || null; }
  addSign(patch) {
    const sign = {
      id: uid(), samples: [], createdAt: Date.now(),
      name: "", meaning: "", category: "Greetings", description: "",
      type: "static", example: "", voiceText: "", difficulty: "Easy",
      language: "Indian Sign Language", emoji: "🤟", ...patch,
    };
    this.data.signs.unshift(sign);
    this.log(`Added sign "${sign.name}"`);
    this._save();
    return sign;
  }
  updateSign(id, patch) {
    const s = this.getSign(id);
    if (!s) return null;
    Object.assign(s, patch);
    this.log(`Updated sign "${s.name}"`);
    this._save();
    return s;
  }
  deleteSign(id) {
    const s = this.getSign(id);
    this.data.signs = this.data.signs.filter(x => x.id !== id);
    this.data.history = this.data.history.filter(h => h.signId !== id);
    if (s) this.log(`Deleted sign "${s.name}"`);
    this._save();
  }

  /* ---------------- samples ---------------- */
  addSample(signId, features, type = "static") {
    const s = this.getSign(signId);
    if (!s) return;
    s.samples.push({ id: uid(), type, f: features, createdAt: Date.now() });
    this.log(`Recorded a ${type} sample for "${s.name}"`);
    this._save();
  }
  deleteSample(signId, sampleId) {
    const s = this.getSign(signId);
    if (!s) return;
    s.samples = s.samples.filter(x => x.id !== sampleId);
    this._save();
  }
  getSamples(signId) { return this.getSign(signId)?.samples || []; }
  trainedSigns() { return this.data.signs.filter(s => s.samples.length > 0); }
  totalSamples() { return this.data.signs.reduce((n, s) => n + s.samples.length, 0); }

  /* ---------------- history ---------------- */
  addHistory(entry) {
    this.data.history.unshift({ id: uid(), ts: Date.now(), ...entry });
    if (this.data.history.length > 300) this.data.history.length = 300;
    this._save();
  }
  getHistory() { return this.data.history; }
  deleteHistory(id) { this.data.history = this.data.history.filter(h => h.id !== id); this._save(); }
  clearHistory() { this.data.history = []; this.log("Cleared communication history"); this._save(); }

  /* ---------------- settings ---------------- */
  getSettings() { return this.data.settings; }
  setSettings(patch) { Object.assign(this.data.settings, patch); this._save(); return this.data.settings; }

  /* ---------------- progress (practice) ---------------- */
  getProgress() { return this.data.progress; }
  markPracticed(signId, score) {
    const p = this.data.progress.find(x => x.signId === signId);
    if (p) { p.attempts++; p.best = Math.max(p.best, score); p.ts = Date.now(); }
    else this.data.progress.push({ signId, attempts: 1, best: score, ts: Date.now() });
    this._save();
  }

  /* ---------------- admin (prototype auth) ---------------- */
  hasAdminPass() { return !!this.data.adminPass; }
  setAdminPass(pass) { this.data.adminPass = weakHash(pass); this.data.isAdmin = true; this.log("Admin passphrase set"); this._save(); }
  checkAdminPass(pass) { return this.data.adminPass === weakHash(pass); }
  isAdmin() { return !!this.data.isAdmin; }
  setAdmin(v) { this.data.isAdmin = !!v; this._save(); }

  /* ---------------- activity log ---------------- */
  log(msg) {
    this.data.log.unshift({ id: uid(), ts: Date.now(), msg });
    if (this.data.log.length > 200) this.data.log.length = 200;
  }
  getLog() { return this.data.log; }

  /* ---------------- stats ---------------- */
  stats() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      totalSigns: this.data.signs.length,
      totalSamples: this.totalSamples(),
      staticSigns: this.data.signs.filter(s => s.type === "static").length,
      dynamicSigns: this.data.signs.filter(s => s.type === "dynamic").length,
      recognitionsToday: this.data.history.filter(h => h.ts >= today.getTime()).length,
      trained: this.trainedSigns().length,
    };
  }

  /* ---------------- reset / export ---------------- */
  export() { return JSON.stringify(this.data, null, 2); }
  resetAll() { this.data = {}; localStorage.removeItem(KEY); this._load(); }
}

export const store = new Store();
export { uid, weakHash };
