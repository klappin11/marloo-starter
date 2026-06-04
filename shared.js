// shared.js — used by BOTH pages (index.html and tracker.html).
// Holds the client store (saved in the browser) and the conversion-risk model.

const STORE_KEY = "marloo_clients_v1";

// Read/write the list of tracked clients from the browser's localStorage.
function loadClients() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch (e) { return []; }
}
function saveClients(list) { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }

function upsertClient(c) {
  const list = loadClients();
  const i = list.findIndex(x => x.id === c.id);
  if (i >= 0) list[i] = c; else list.push(c);
  saveClients(list);
}
function removeClient(id) { saveClients(loadClients().filter(c => c.id !== id)); }

// ---- Conversion-risk model (transparent + tunable) -----------------------
// Core idea: value is felt at the FIRST file note (>= 1 meeting = activated).
// If an adviser hasn't activated and the trial is running out, conversion
// becomes unlikely — that's the outreach threshold we flag.

const THRESHOLD_DAY = 9; // ~64% through a 14-day trial. Tune this number.

function assessClient(c) {
  const day = Number(c.trial_day) || 0;
  const left = Math.max(0, 14 - day);
  const meetings = Number(c.meetings) || 0;
  const clients = Number(c.clients) || 0;

  const activated = meetings >= 1;            // saw first file note
  const habit = meetings >= 3 && clients >= 2; // using it across clients
  const pastThreshold = !activated && day >= THRESHOLD_DAY;

  let status, score; // score = rough conversion likelihood, 0-100
  if (habit)                         { status = "Healthy";        score = 82; }
  else if (activated && left > 3)    { status = "Needs nudge";    score = 56; }
  else if (activated)                { status = "Closing window"; score = 38; }
  else if (!activated && day < THRESHOLD_DAY) { status = "Not yet activated"; score = 30; }
  else if (left > 0)                 { status = "At risk";        score = 14; }
  else                               { status = "Likely lost";    score = 4; }

  // Which colour bucket the UI should use.
  let tone = "warm";
  if (score >= 70) tone = "good";
  else if (score < 20) tone = "hot";   // urgent / flagged
  else if (score < 40) tone = "cool";

  return { activated, habit, left, pastThreshold, status, score, tone, thresholdDay: THRESHOLD_DAY };
}
