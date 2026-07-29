import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeSharedSecret } from "../_shared/security.mjs";

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: { id?: string } | null;
}

interface ProcessedLead {
  id: string;
  customer_id: string;
  task_id: string;
  business_name: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  lead_email: string | null;
  service_requested: string | null;
  urgency: string | null;
  message: string | null;
  source_channel: string | null;
  inquiry_type: string | null;
  received_at: string | null;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const INTAKE_SECRET = Deno.env.get("INTAKE_PROCESSOR_SECRET");
const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
const ALERT_TO = Deno.env.get("ALERT_EMAIL_TO");
const ALERT_FROM = Deno.env.get("ALERT_EMAIL_FROM") || "G7CRM Alerts <onboarding@resend.dev>";
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://g7systems.xyz/dashboard.html";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const authorization = authorizeSharedSecret(
    INTAKE_SECRET,
    req.headers.get("x-g7-intake-secret") ?? undefined,
  );
  if (!authorization.ok) {
    return jsonResponse({ error: authorization.error }, authorization.status);
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return jsonResponse({ error: "server configuration error" }, 500);
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  if (payload.type !== "INSERT" || payload.table !== "lead_submissions") {
    return jsonResponse({ skipped: "not a lead_submissions insert" }, 200);
  }

  const recordId = payload.record?.id;
  if (!recordId) return jsonResponse({ error: "missing record id" }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Customer, task, audit and lead-status writes happen in one PostgreSQL
  // transaction. Any database error rolls back every effect.
  const { data, error } = await supabase.rpc("process_lead_submission", {
    p_id: recordId,
  });
  if (error) {
    console.error("atomic lead processing failed", error.code);
    return jsonResponse({ error: "lead processing failed" }, 500);
  }
  if (!data) return jsonResponse({ skipped: "already processed or unavailable" }, 200);

  const lead = data as ProcessedLead;
  let emailStatus = "skipped (email not configured)";
  if (RESEND_KEY && ALERT_TO) {
    emailStatus = await sendLeadEmail(lead);
  }

  return jsonResponse({
    ok: true,
    lead_id: lead.id,
    customer_id: lead.customer_id,
    task_id: lead.task_id,
    email: emailStatus,
  }, 200);
});

async function sendLeadEmail(lead: ProcessedLead): Promise<string> {
  const subjectPrefix =
      lead.inquiry_type === "urgent-call" ? "[URGENT] "
    : lead.inquiry_type === "booking" ? "[Booking] "
    : "[Lead] ";
  const subject = `${subjectPrefix}${lead.business_name || "Unknown business"} — G7CRM`;
  const body = [
    `New ${lead.inquiry_type || "standard"} lead`,
    "",
    `Business:  ${lead.business_name || "—"}`,
    `Contact:   ${lead.lead_name || "—"}`,
    `Phone:     ${lead.lead_phone || "—"}`,
    `Email:     ${lead.lead_email || "—"}`,
    `Service:   ${lead.service_requested || "—"}`,
    `Urgency:   ${lead.urgency || "—"}`,
    "",
    `Message:   ${lead.message || "—"}`,
    "",
    `Source:    ${lead.source_channel || "—"}`,
    `Submitted: ${lead.received_at || "—"}`,
    "",
    `Open in G7CRM: ${DASHBOARD_URL}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `g7-lead-alert-${lead.id}`,
      },
      body: JSON.stringify({ from: ALERT_FROM, to: [ALERT_TO], subject, text: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return "sent";
    console.error("resend failed", response.status, await response.text());
    return `failed (${response.status})`;
  } catch (error) {
    console.error("resend request failed", error instanceof Error ? error.name : "unknown");
    return "failed (network)";
  }
}

function jsonResponse(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}
