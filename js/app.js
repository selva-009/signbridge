/* ==========================================================================
   app.js — router + bootstrap.
   Hash-based routing so the whole app is one static bundle on GitHub Pages.
   ========================================================================== */

import { views } from "./views.js";
import { stopSpeech } from "./helpers.js";

const main = document.getElementById("main");
let cleanup = null;

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [path, queryStr] = raw.split("?");
  const params = {};
  if (queryStr) new URLSearchParams(queryStr).forEach((v, k) => params[k] = v);
  const seg = path.split("/").filter(Boolean); // e.g. ["admin","signs"]
  return { seg, params };
}

function route() {
  const { seg, params } = parseHash();
  const head = seg[0] || "";

  if (typeof cleanup === "function") { try { cleanup(); } catch { /* noop */ } cleanup = null; }
  stopSpeech();

  let view;
  switch (head) {
    case "live":    view = views.live(params); break;
    case "library": view = views.library(params); break;
    case "practice":view = views.practice(params); break;
    case "history": view = views.history(params); break;
    case "admin":   view = views.admin({ ...params, section: seg[1] || "" }); break;
    default:        view = views.landing(params);
  }

  main.innerHTML = view.html;
  document.title = view.title || "SignBridge AI";
  if (typeof view.mount === "function") cleanup = view.mount(main) || null;

  // nav highlight
  const active = head ? "#/" + head : "#/";
  document.querySelectorAll("#mainnav a").forEach(a => {
    const href = a.getAttribute("href");
    const isActive = href === active || (head === "" && href === "#/");
    if (isActive) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });

  // close mobile nav + focus main for screen readers
  const nav = document.getElementById("mainnav");
  nav?.classList.remove("open");
  document.getElementById("navToggle")?.setAttribute("aria-expanded", "false");
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
}

/* mobile nav toggle */
const navToggle = document.getElementById("navToggle");
navToggle?.addEventListener("click", () => {
  const nav = document.getElementById("mainnav");
  const open = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});

window.addEventListener("hashchange", route);
window.addEventListener("DOMContentLoaded", route);
if (document.readyState !== "loading") route();
