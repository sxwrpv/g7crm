import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// intake-processor edge function
//
// Triggered by an AFTER INSERT trigger on public.lead_submissions
// (see supabase/migrations/<timestamp>_lead_submissions_intake_trigger.sql).
//
// Flow:
//   1. Re-fetch the lead from the DB by id (never trusts webhook payload).
//   2. Idempotency: skip if submission_status is already 'processed'.
//   3. Upsert the lead into customers on conflict by email.
//   4. Mark the lead_submission processed + link customer_id.
//   5. Create a follow-up task with priority based on urgency.
//   6. Log an automation_runs row.
//   7. If RESEND_API_KEY + ALERT_EMAIL_TO are set in the function env,
//      send an email alert via Resend.
//
// Environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
//   - SUPABASE_URL                 — auto-provided
//   - SUPABASE_SERVICE_ROLE_KEY    — auto-provided
//   - RESEND_API_KEY               — re_… from resend.com
//   - ALERT_EMAIL_TO               — e.g. sxwrpv2022@gmail.com
//   - ALERT_EMAIL_FROM             — e.g. "G7CRM Alerts <onboarding@resend.dev>"
//   - DASHBOARD_URL                — optional override, defaults to g7systems.xyz/dashboard.html
// ============================================================================

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY    = Deno.env.get("RESEND_API_KEY");
const ALERT_TO      = Deno.env.get("ALERT_EMAIL_TO");
const ALERT_FROM    = Deno.env.get("ALERT_EMAIL_FROM") || "G7CRM Alerts <onboarding@resend.dev>";
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://g7systems.xyz/dashboard.html";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let payload: WebhookPayload;
  try { payload = await req.json(); }
  catch { return jsonResponse({ error: "invalid json" }, 400); }

  if (payload.type !== "INSERT" || payload.table !== "lead_submissions") {
    return jsonResponse({ skipped: "not a lead_submissions insert" }, 200);
  }

  const recordId = (payload.record as { id?: string } | null)?.id;
  if (!recordId) return jsonResponse({ error: "missing record id" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Refetch from DB — never trust webhook payload contents
  const { data: lead, error: leadErr } = await supabase
    .from("lead_submissions").select("*").eq("id", recordId).single();

  if (leadErr || !lead) return jsonResponse({ error: "lead not found", id: recordId }, 404);

  // Idempotency — don't double-process
  if (lead.submission_status === "processed") {
    return jsonResponse({ skipped: "already processed", id: lead.id }, 200);
  }

  // 1. Find-or-create customer by email.
  // Deliberately NOT a blind upsert: a repeat submission from an existing
  // client must not downgrade record_type back to "lead" or reset
  // onboarding_status — only refresh contact fields + next action.
  const customerEmail = lead.lead_email || `missing-${Date.now()}-${recordId.slice(0, 8)}@placeholder.local`;
  const nextAction =
      lead.inquiry_type === "booking"     ? "Confirm booking request and lock time."
    : lead.inquiry_type === "urgent-call" ? "Call back immediately."
    :                                       "Review new inbound lead and qualify.";

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id, phone, company")
    .eq("email", customerEmail)
    .maybeSingle();

  let customer = null;
  let custErr = null;
  if (existingCustomer) {
    ({ data: customer, error: custErr } = await supabase
      .from("customers")
      .update({
        phone: lead.lead_phone || existingCustomer.phone,
        company: existingCustomer.company || lead.business_name,
        next_action: nextAction,
        last_contacted_at: new Date().toISOString(),
      })
      .eq("id", existingCustomer.id)
      .select().single());
  } else {
    ({ data: customer, error: custErr } = await supabase
      .from("customers")
      .insert({
        name: lead.lead_name,
        company: lead.business_name,
        email: customerEmail,
        phone: lead.lead_phone,
        record_type: "lead",
        niche: "Home Services",
        source_channel: lead.source_channel || "website-form",
        onboarding_status: "not-started",
        preferred_alert_channel: "email",
        next_action: nextAction,
        last_contacted_at: new Date().toISOString(),
      })
      .select().single());
  }

  if (custErr) console.error("customer find-or-create failed", custErr);
  const customerId = customer?.id ?? null;

  // 2. Mark submission processed + link customer.
  // If the customer step failed, leave the row 'new' so it stays visible
  // in the dashboard's new-leads counter instead of vanishing silently.
  if (customerId) {
    await supabase.from("lead_submissions").update({
      customer_id: customerId,
      submission_status: "processed",
      processed_at: new Date().toISOString(),
    }).eq("id", lead.id);
  }

  // 3. Create follow-up task
  const priority =
      lead.urgency === "emergency" ? "urgent"
    : lead.urgency === "high"      ? "high"
    :                                "medium";
  const title =
      lead.inquiry_type === "urgent-call" ? `Urgent call: ${lead.business_name}`
    : lead.inquiry_type === "booking"      ? `Booking: ${lead.business_name}`
    :                                        `Follow up: ${lead.business_name}`;
  const description = [lead.service_requested, lead.message ? `\nMessage: ${lead.message}` : ""].join("").trim();
  const dueDate = lead.inquiry_type === "booking" ? lead.requested_booking_date : null;

  let taskId: string | null = null;
  if (customerId) {
    const { data: task } = await supabase.from("tasks").insert({
      customer_id: customerId,
      title,
      description,
      status: "pending",
      task_type: "follow-up",
      priority,
      assigned_to: "ops",
      due_date: dueDate,
    }).select().single();
    taskId = task?.id ?? null;
  }

  // 4. Log automation run
  const summary =
      lead.inquiry_type === "urgent-call" ? `Urgent call request for ${lead.business_name}`
    : lead.inquiry_type === "booking"      ? `Booking request for ${lead.business_name}`
    :                                        `New inbound lead for ${lead.business_name}`;

  await supabase.from("automation_runs").insert({
    customer_id: customerId,
    lead_submission_id: lead.id,
    workflow_name: "intake-processor (edge function)",
    workflow_run_id: `efn_${Date.now()}`,
    run_status: customerId ? "success" : "failed",
    summary,
    payload: {
      inquiry_type: lead.inquiry_type,
      service_requested: lead.service_requested,
      urgency: lead.urgency,
      task_id: taskId,
    },
  });

  // 5. Email alert via Resend
  let emailStatus = "skipped (no RESEND_API_KEY)";
  if (RESEND_KEY && ALERT_TO) {
    const subjectPrefix =
        lead.inquiry_type === "urgent-call" ? "[URGENT] "
      : lead.inquiry_type === "booking"      ? "[Booking] "
      :                                        "[Lead] ";
    const subject = `${subjectPrefix}${lead.business_name} — G7CRM`;
    const body = [
      `New ${lead.inquiry_type} lead`,
      "",
      `Business:  ${lead.business_name}`,
      `Contact:   ${lead.lead_name}`,
      `Phone:     ${lead.lead_phone || "—"}`,
      `Email:     ${lead.lead_email || "—"}`,
      `Service:   ${lead.service_requested}`,
      `Urgency:   ${lead.urgency}`,
      "",
      `Message:   ${lead.message || "—"}`,
      "",
      `Source:    ${lead.source_channel}`,
      `Submitted: ${lead.received_at}`,
      "",
      `Open in G7CRM: ${DASHBOARD_URL}`,
    ].join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: ALERT_FROM, to: [ALERT_TO], subject, text: body }),
    });
    emailStatus = res.ok ? "sent" : `failed (${res.status})`;
    if (!res.ok) console.error("resend failed", res.status, await res.text());
  } else if (!ALERT_TO) {
    emailStatus = "skipped (no ALERT_EMAIL_TO)";
  }

  return jsonResponse({
    ok: true,
    lead_id: lead.id,
    customer_id: customerId,
    task_id: taskId,
    email: emailStatus,
  }, 200);
});

function jsonResponse(obj: unknown, status: number) {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
