// G7CRM — WhatsApp auto-reply agent
// Supabase Edge Function: whatsapp-webhook
//
// Mirrors the conventions of intake-processor (same project):
//   - service-role client, refetch-from-DB where it matters
//   - upsert customer, log interaction + task + automation_runs
//   - jsonResponse() helper, verify_jwt=false (this is an external webhook)
//
// Wire this up as the Twilio WhatsApp "A message comes in" webhook:
//   https://fbstesgbttojfysznddq.supabase.co/functions/v1/whatsapp-webhook
//
// See docs/WHATSAPP_SETUP.md for the full Twilio + env var walkthrough.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TWILIO_SID      = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_TOKEN    = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM     = Deno.env.get("TWILIO_WHATSAPP_FROM"); // e.g. "whatsapp:+14155238886" (sandbox) or your approved sender
const WEBHOOK_URL     = Deno.env.get("WHATSAPP_WEBHOOK_URL");  // public URL Twilio calls — needed for signature check
const VERIFY_SIGNATURE = (Deno.env.get("WHATSAPP_VERIFY_SIGNATURE") ?? "true") !== "false";
const AUTO_REPLY_TMPL = Deno.env.get("AUTO_REPLY_TEXT") ||
  "Hi{name}, thanks for messaging G7 Systems! We've got your message and someone will follow up shortly. " +
  "If this is urgent, please call us directly.";
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://g7systems.xyz/dashboard.html";

const URGENT_KEYWORDS = ["emergency", "urgent", "asap", "burst", "leak", "flooding", "no heat", "no power", "help now"];

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  // --- Verify this really came from Twilio ---------------------------------
  if (VERIFY_SIGNATURE) {
    const signature = req.headers.get("X-Twilio-Signature");
    const ok = TWILIO_TOKEN && WEBHOOK_URL && signature &&
      await validateTwilioSignature(TWILIO_TOKEN, signature, WEBHOOK_URL, params);
    if (!ok) return jsonResponse({ error: "invalid twilio signature" }, 403);
  }

  const fromRaw = params["From"] || "";       // "whatsapp:+353871234567"
  const toRaw   = params["To"] || "";
  const body    = (params["Body"] || "").trim();
  const profileName = params["ProfileName"] || null;
  const messageSid  = params["MessageSid"] || null;
  const waId        = params["WaId"] || fromRaw.replace(/^whatsapp:/, "");
  const numMedia    = Number(params["NumMedia"] || "0");

  const fromNumber = normalizePhone(fromRaw);
  if (!fromNumber) return jsonResponse({ error: "missing From" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 0. Idempotency — Twilio retries the webhook on timeouts/5xx. If we've
  //    already logged this MessageSid, ack and stop (no duplicate task/reply).
  if (messageSid) {
    const { data: dupe } = await supabase
      .from("interactions")
      .select("id")
      .eq("type", "whatsapp")
      .eq("direction", "inbound")
      .contains("metadata", { message_sid: messageSid })
      .limit(1)
      .maybeSingle();
    if (dupe) return twimlOk();
  }

  // 1. Find or create the customer by WhatsApp number ------------------------
  const { data: existing } = await supabase
    .from("customers")
    .select("*")
    .or(`whatsapp.eq.${fromNumber},phone.eq.${fromNumber}`)
    .limit(1)
    .maybeSingle();

  const lowerBody = body.toLowerCase();
  const isUrgent = URGENT_KEYWORDS.some((kw) => lowerBody.includes(kw));
  const nextAction = isUrgent ? "Call back immediately — urgent WhatsApp inbound." : "Review WhatsApp message and follow up.";

  let customerId: string | null = existing?.id ?? null;

  if (existing) {
    await supabase.from("customers").update({
      whatsapp: fromNumber,
      last_contacted_at: new Date().toISOString(),
      next_action: nextAction,
      // an urgent message heats the lead up, but never cools it back down
      ...(isUrgent ? { lead_temperature: "hot" } : {}),
    }).eq("id", existing.id);
  } else {
    const placeholderEmail = `whatsapp-${fromNumber.replace(/[^0-9]/g, "")}@placeholder.local`;
    const { data: created, error: custErr } = await supabase
      .from("customers")
      .insert({
        name: profileName || fromNumber,
        email: placeholderEmail,
        phone: fromNumber,
        whatsapp: fromNumber,
        record_type: "lead",
        niche: "Home Services",
        source_channel: "whatsapp",
        onboarding_status: "not-started",
        preferred_alert_channel: "whatsapp",
        lead_temperature: isUrgent ? "hot" : "warm",
        next_action: nextAction,
        last_contacted_at: new Date().toISOString(),
      })
      .select().single();
    if (custErr) console.error("customer insert failed", custErr);
    customerId = created?.id ?? null;
  }

  // interactions.customer_id is NOT NULL — without a customer row there is
  // nothing valid to log against, so record the failure and bail out early.
  if (!customerId) {
    await supabase.from("automation_runs").insert({
      workflow_name: "whatsapp-webhook (edge function)",
      workflow_run_id: messageSid || `wfn_${Date.now()}`,
      run_status: "failed",
      summary: `Inbound WhatsApp from ${profileName || fromNumber} — customer create failed`,
      payload: { from: fromNumber, body, urgent: isUrgent },
    });
    return twimlOk();
  }

  // 2. Log the inbound message as an interaction ------------------------------
  await supabase.from("interactions").insert({
    customer_id: customerId,
    type: "whatsapp",
    direction: "inbound",
    subject: `WhatsApp message from ${profileName || fromNumber}`,
    notes: body || (numMedia > 0 ? "(media message, no text)" : ""),
    created_by: "whatsapp-webhook",
    metadata: { message_sid: messageSid, wa_id: waId, num_media: numMedia, to: toRaw },
  });

  // 3. Follow-up task — reuse an open one for this customer instead of spamming
  let taskId: string | null = null;
  {
    const { data: openTask } = await supabase
      .from("tasks")
      .select("id, description")
      .eq("customer_id", customerId)
      .eq("task_type", "follow-up")
      .in("status", ["pending", "in-progress"])
      .ilike("title", "WhatsApp:%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openTask) {
      await supabase.from("tasks").update({
        description: `${openTask.description || ""}\n[${new Date().toISOString()}] ${body}`.trim(),
        ...(isUrgent ? { priority: "urgent" } : {}),
      }).eq("id", openTask.id);
      taskId = openTask.id;
    } else {
      const { data: task } = await supabase.from("tasks").insert({
        customer_id: customerId,
        title: `WhatsApp: ${profileName || fromNumber}`,
        description: body,
        status: "pending",
        task_type: "follow-up",
        priority: isUrgent ? "urgent" : "medium",
        assigned_to: "ops",
      }).select().single();
      taskId = task?.id ?? null;
    }
  }

  // 4. Auto-reply back on WhatsApp ---------------------------------------------
  const replyText = AUTO_REPLY_TMPL.replace("{name}", profileName ? ` ${profileName}` : "");
  let replyStatus = "skipped (no Twilio credentials)";

  if (TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: TWILIO_FROM,
          To: `whatsapp:${fromNumber}`,
          Body: replyText,
        }),
      },
    );
    replyStatus = res.ok ? "sent" : `failed (${res.status})`;
    if (!res.ok) console.error("twilio send failed", res.status, await res.text());

    await supabase.from("interactions").insert({
      customer_id: customerId,
      type: "whatsapp",
      direction: "outbound",
      subject: "Auto-reply sent",
      notes: replyText,
      created_by: "whatsapp-webhook",
      metadata: { status: replyStatus },
    });
  }

  // 5. Log automation run --------------------------------------------------------
  await supabase.from("automation_runs").insert({
    customer_id: customerId,
    workflow_name: "whatsapp-webhook (edge function)",
    workflow_run_id: messageSid || `wfn_${Date.now()}`,
    run_status: replyStatus === "sent" || replyStatus.startsWith("skipped") ? "success" : "warning",
    summary: `Inbound WhatsApp from ${profileName || fromNumber}${isUrgent ? " (urgent)" : ""}`,
    payload: { from: fromNumber, body, urgent: isUrgent, task_id: taskId, reply_status: replyStatus, dashboard: DASHBOARD_URL },
  });

  return twimlOk();
});

// Twilio just needs a 200; empty TwiML keeps it happy either way.
function twimlOk() {
  return new Response("<Response></Response>", {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

function normalizePhone(waFrom: string): string | null {
  const stripped = waFrom.replace(/^whatsapp:/, "").trim();
  return stripped || null;
}

async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): Promise<boolean> {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)));
  const expected = btoa(String.fromCharCode(...sigBytes));
  return timingSafeEqual(expected, signature);
}

// Constant-time comparison — avoids leaking signature bytes via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function jsonResponse(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
