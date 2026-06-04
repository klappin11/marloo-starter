// This file runs on Vercel's SERVERS, never in the browser.
// That's why it's safe to use your secret API key here.
// Vercel automatically turns any file in the /api folder into a live web address:
//   this file  ->  yoursite.vercel.app/api/generate

export default async function handler(req, res) {
  // Only accept POST requests (that's what the page sends).
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Read the secret key from Vercel's settings (you'll add it in the dashboard).
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY in Vercel settings." });
  }

  // The adviser the page sent us.
  const adviser = (req.body && req.body.adviser) || {};

  // This is the instruction we give the AI. The smarter this is, the smarter
  // the output. This is where your GTM thinking lives.
  const systemPrompt = `You are the conversion strategist for Marloo, an AI platform for financial advisers.
Marloo records client meetings and turns them into compliant file notes and advice documents.
Trials convert when an adviser experiences value (a file note from a real meeting), and the biggest
revenue comes from a solo adviser rolling Marloo out to their whole firm (Marloo Teams).
Advisers are cautious about client-data security and compliance, so be honest and never pushy.

Given one trial adviser, write a short conversion play in plain text with three labelled parts:
1. DIAGNOSIS — where they are and what's blocking them (1-2 sentences).
2. PLAY — the single best next move and why (1-2 sentences).
3. DRAFT OUTREACH — a short message to send, in a calm adviser-to-adviser tone, no hype.`;

  const userPrompt = `Adviser: ${adviser.name}
Role: ${adviser.role}
Behaviour: ${adviser.signal}`;

  try {
    // Call the Anthropic API. This is the cloud-based model doing the work.
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // cheap + fast; "claude-sonnet-4-6" for better writing
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: (data.error && data.error.message) || "AI request failed" });
    }

    // Pull the text out of the reply and send it back to the page.
    const play = (data.content || []).map(b => b.text || "").join("").trim();
    return res.status(200).json({ play });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
