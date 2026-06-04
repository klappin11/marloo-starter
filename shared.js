// shared.js — used by BOTH pages. Client store + the free->paid conversion model.
// Marloo free tier = "first 10 meetings included" (a USAGE cap, not a time limit),
// so the model is built around meetings-toward-cap, not trial days.

const STORE_KEY = "marloo_leads_v2";
const PRICES = { Plus: 99, Pro: 299 }; // $/user/month

function loadClients() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch (e) { return []; } }
function saveClients(list) { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
function upsertClient(c) { const l = loadClients(); const i = l.findIndex(x => x.id === c.id); if (i >= 0) l[i] = c; else l.push(c); saveClients(l); }
function removeClient(id) { saveClients(loadClients().filter(c => c.id !== id)); }

// ---- Free -> paid conversion model (transparent + tunable) ----------------
// Drivers: meetings used (of 10), advice docs generated, advisers at firm,
//          days since last active, whether teammates were invited.
const FREE_MEETING_CAP = 10;

function assessLead(c) {
  const meetings = Math.min(FREE_MEETING_CAP, Number(c.meetings) || 0);
  const docs      = Number(c.docs) || 0;
  const advisers  = Math.max(1, Number(c.advisers) || 1);
  const idle      = Number(c.daysInactive) || 0;
  const invited   = !!c.team_invited;

  const activated = meetings >= 1;              // experienced value (first file note)
  const atCap     = meetings >= FREE_MEETING_CAP;
  const nearCap   = meetings >= 7 && meetings < FREE_MEETING_CAP;
  const habit     = meetings >= 3;
  const heavyDocs = docs >= 6;                  // leaning on document workflows -> Pro
  const stale     = idle >= 10;
  const veryStale = idle >= 21;

  // Recommended plan: meetings cap -> Plus ($99 unlimited meetings);
  // heavy advice-document workflows -> Pro ($299). Large firm -> Enterprise convo.
  let plan = heavyDocs ? "Pro" : "Plus";
  const enterprise = advisers >= 8;
  const planPrice = PRICES[plan];

  // Conversion likelihood (0-100), reframed for a usage cap.
  let score, state;
  if (atCap && !stale)          { score = 88; state = "At the cap — convert now"; }
  else if (nearCap && !stale)   { score = 72; state = "Approaching cap"; }
  else if (atCap && stale)      { score = 46; state = "Stalled at paywall"; }
  else if (habit && !stale)     { score = 54; state = "Building habit"; }
  else if (activated && !stale) { score = 40; state = "Activated, early"; }
  else if (!activated && !stale){ score = 22; state = "Not activated"; }
  else if (activated && stale)  { score = 20; state = "Gone quiet"; }
  else                          { score = 8;  state = "Cold"; }
  if (veryStale) score = Math.min(score, 12);
  if (invited)   score = Math.min(99, score + 6); // colleagues invited = expansion intent

  // Money: firm-wide monthly potential if they convert all advisers.
  const dealValue = planPrice * advisers;
  const urgency = atCap ? 1 : nearCap ? 0.8 : habit ? 0.5 : 0.3;
  const priority = Math.round(dealValue * (score / 100) * urgency); // "work this now"

  let tone = "warm";
  if (score >= 70) tone = "act";        // ready to convert — highlight
  else if (score < 22) tone = "dead";   // unlikely — deprioritise
  else if (score < 40) tone = "cool";

  return { activated, atCap, nearCap, stale, plan, enterprise, planPrice,
           dealValue, score, state, tone, priority, urgency, idle };
}
