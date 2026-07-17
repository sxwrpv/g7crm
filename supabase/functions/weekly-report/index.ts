// G7CRM — weekly automated reports
// Supabase Edge Function: weekly-report
//
// Triggered every Monday 08:00 UTC by pg_cron (see
// supabase/migrations/20260717_weekly_client_reports.sql).
//
// What it sends:
//   - One report email per live client (customers.record_type='client' AND
//     onboarding_status='live'): enquiries caught, urgent calls, bookings,
//     WhatsApp messages handled, estimated pipeline value.
//   - One operator digest to ALERT_EMAIL_TO: totals, per-client one-liners,
//     own-pipeline health (new/unprocessed leads, overdue tasks).
//
// Safety valve: client emails only go out when REPORTS_ENABLED=true is set
// in the function secrets. Until then every run is a dry-run — the operator
// digest still arrives (so you can proof-read what clients WOULD get).
//
// Env (Supabase Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY, ALERT_EMAIL_TO, ALERT_EMAIL_FROM  — same as intake-processor
//   REPORTS_ENABLED — "true" to actually email clients (default: dry-run)
//   REPORT_SECRET   — if set, requests must carry x-g7-secret matching it
//   EST_JOB_VALUE   — € value used for the estimate line (default 400)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY");
const ALERT_TO     = Deno.env.get("ALERT_EMAIL_TO");
const ALERT_FROM   = Deno.env.get("ALERT_EMAIL_FROM") || "G7 Systems <onboarding@resend.dev>";
const ENABLED      = (Deno.env.get("REPORTS_ENABLED") ?? "false") === "true";
const SECRET       = Deno.env.get("REPORT_SECRET");
const EST_VALUE    = Number(Deno.env.get("EST_JOB_VALUE") || "400");

interface ClientStats {
  id: string;
  name: string;
  company: string | null;
  email: string;
  leads: number;
  urgent: number;
  bookings: number;
  whatsappIn: number;
  emailed: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (SECRET && req.headers.get("x-g7-secret") !== SECRET) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const weekLabel = `${fmtDay(since)} – ${fmtDay(new Date().toISOString())}`;

  // ---- Live clients -------------------------------------------------------
  const { data: clients } = await supabase
    .from("customers")
    .select("id, name, company, email")
    .eq("record_type", "client")
    .eq("onboarding_status", "live");

  const stats: ClientStats[] = [];
  for (const c of clients ?? []) {
    const [leadsRes, waRes] = await Promise.all([
      supabase.from("lead_submissions")
        .select("id, urgency, inquiry_type")
        .eq("client_id", c.id)
        .gte("received_at", since),
      supabase.from("interactions")
        .select("id", { count: "exact", head: true })
        .eq("client_id", c.id)
        .eq("type", "whatsapp")
        .eq("direction", "inbound")
        .gte("date", since),
    ]);
    const leads = leadsRes.data ?? [];
    stats.push({
      id: c.id,
      name: c.name,
      company: c.company,
      email: c.email,
      leads: leads.length,
      urgent: leads.filter((l) => l.urgency === "high" || l.urgency === "emergency").length,
      bookings: leads.filter((l) => l.inquiry_type === "booking").length,
      whatsappIn: waRes.count ?? 0,
      emailed: false,
    });
  }

  // ---- Send client reports (gated) ---------------------------------------
  for (const s of stats) {
    const sendable = RESEND_KEY && ENABLED && s.email && !s.email.endsWith("placeholder.local");
    if (!sendable) continue;
    const ok = await sendEmail(s.email, `Your week with G7 Systems — ${weekLabel}`, clientHtml(s, weekLabel), clientText(s, weekLabel));
    s.emailed = ok;
  }

  // ---- Own pipeline health ------------------------------------------------
  const today = new Date().toISOString().slice(0, 10);
  const [ownLeadsRes, unprocessedRes, overdueRes] = await Promise.all([
    supabase.from("lead_submissions").select("id", { count: "exact", head: true })
      .is("client_id", null).gte("received_at", since),
    supabase.from("lead_submissions").select("id", { count: "exact", head: true })
      .eq("submission_status", "new"),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .neq("status", "done").lt("due_date", today),
  ]);

  // ---- Operator digest ----------------------------------------------------
  let digestStatus = "skipped (no RESEND_API_KEY or ALERT_EMAIL_TO)";
  if (RESEND_KEY && ALERT_TO) {
    const lines = [
      `G7 weekly digest — ${weekLabel}`,
      "",
      `Own pipeline: ${ownLeadsRes.count ?? 0} new leads this week · ${unprocessedRes.count ?? 0} still unprocessed · ${overdueRes.count ?? 0} overdue tasks`,
      "",
      stats.length
        ? "Clients:"
        : `Clients: none live yet — client report emails are ${ENABLED ? "ENABLED" : "in dry-run"}.`,
      ...stats.map((s) =>
        `  · ${s.company || s.name}: ${s.leads} enquiries (${s.urgent} urgent, ${s.bookings} bookings), ${s.whatsappIn} WhatsApp in — report ${s.emailed ? "sent" : (ENABLED ? "NOT sent (bad email)" : "dry-run, not sent")}`),
      "",
      `Client emails gate: REPORTS_ENABLED=${ENABLED}`,
    ];
    digestStatus = (await sendEmail(ALERT_TO, `[G7 digest] Week ${weekLabel}`, null, lines.join("\n")))
      ? "sent" : "failed";
  }

  // ---- Audit log ----------------------------------------------------------
  await supabase.from("automation_runs").insert({
    workflow_name: "weekly-report (edge function)",
    workflow_run_id: `wr_${Date.now()}`,
    run_status: "success",
    summary: `Weekly reports: ${stats.filter((s) => s.emailed).length}/${stats.length} client emails sent (enabled=${ENABLED}), digest ${digestStatus}`,
    payload: { week: weekLabel, enabled: ENABLED, clients: stats.map(({ id, leads, urgent, bookings, whatsappIn, emailed }) => ({ id, leads, urgent, bookings, whatsappIn, emailed })) },
  });

  return jsonResponse({ ok: true, week: weekLabel, enabled: ENABLED, clients: stats.length, digest: digestStatus }, 200);
});

// ---------------------------------------------------------------------------

function clientText(s: ClientStats, week: string): string {
  return [
    `Your week with G7 Systems (${week})`,
    "",
    `Enquiries caught:        ${s.leads}`,
    `Urgent calls flagged:    ${s.urgent}`,
    `Booking requests:        ${s.bookings}`,
    `WhatsApp messages:       ${s.whatsappIn}`,
    `Est. pipeline value:     €${s.leads * EST_VALUE} (at ~€${EST_VALUE}/job)`,
    "",
    "Every one of these got a reply within 5 minutes.",
    "Questions? Just reply to this email.",
    "— G7 Systems",
  ].join("\n");
}

function clientHtml(s: ClientStats, week: string): string {
  const row = (label: string, value: string) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#5b5f66;font-size:14px">${label}</td>
     <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;font-size:16px;color:#0d1015">${value}</td></tr>`;
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <div style="background:#0d1015;border-radius:14px;padding:20px 24px;color:#fff">
      <span style="font-size:18px;font-weight:700">G7<span style="color:#ff6a1a"> ·</span> Systems</span>
      <div style="color:rgba(255,255,255,.6);font-size:13px;margin-top:4px">Your week — ${week}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:18px">
      ${row("Enquiries caught", String(s.leads))}
      ${row("Urgent calls flagged", String(s.urgent))}
      ${row("Booking requests", String(s.bookings))}
      ${row("WhatsApp messages handled", String(s.whatsappIn))}
      ${row("Estimated pipeline value", `€${s.leads * EST_VALUE}`)}
    </table>
    <p style="color:#5b5f66;font-size:13.5px;line-height:1.6;margin-top:18px">
      Every enquiry above got a reply within five minutes — day, night and weekend.
      Estimated value assumes ~€${EST_VALUE} per job. Questions? Just reply to this email.
    </p>
  </div>`;
}

async function sendEmail(to: string, subject: string, html: string | null, text: string): Promise<boolean> {
  const body: Record<string, unknown> = { from: ALERT_FROM, to: [to], subject, text };
  if (html) body.html = html;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) console.error("resend failed", to, res.status, await res.text());
  return res.ok;
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

function jsonResponse(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
