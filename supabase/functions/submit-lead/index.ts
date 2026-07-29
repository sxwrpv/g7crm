import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateLeadPayload } from "../_shared/security.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const TURNSTILE_SECRET = Deno.env.get("TURNSTILE_SECRET_KEY");
const RATE_LIMIT_SALT = Deno.env.get("RATE_LIMIT_SALT") || TURNSTILE_SECRET;
const TURNSTILE_HOSTNAMES = new Set(
  (Deno.env.get("TURNSTILE_HOSTNAMES") || "g7systems.xyz,www.g7systems.xyz")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean),
);
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") || "https://g7systems.xyz,https://www.g7systems.xyz,http://localhost:8000,http://127.0.0.1:8000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

interface TurnstileResult {
  success?: boolean;
  hostname?: string;
  action?: string;
  [key: string]: unknown;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: originAllowed(origin) ? 204 : 403, headers });
  }
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405, headers);
  if (!originAllowed(origin)) return json({ error: "origin not allowed" }, 403, headers);
  if (!SUPABASE_URL || !SERVICE_ROLE || !TURNSTILE_SECRET || !RATE_LIMIT_SALT) {
    return json({ error: "server configuration error" }, 503, headers);
  }

  const declaredLength = Number(req.headers.get("content-length") || "0");
  if (declaredLength > 12_000) return json({ error: "request too large" }, 413, headers);

  let rawBody: string;
  let body: Record<string, unknown>;
  try {
    rawBody = await req.text();
    if (rawBody.length > 12_000) return json({ error: "request too large" }, 413, headers);
    body = JSON.parse(rawBody);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid body");
  } catch {
    return json({ error: "invalid json" }, 400, headers);
  }

  // Honeypot submissions receive a generic success but never reach the database.
  if (typeof body.company_website === "string" && body.company_website.trim()) {
    return json({ ok: true }, 200, headers);
  }

  const turnstileToken = typeof body.turnstile_token === "string" ? body.turnstile_token : "";
  const { turnstile_token: _token, company_website: _honeypot, ...publicFields } = body;
  const validation = validateLeadPayload(publicFields);
  if ("error" in validation) return json({ error: validation.error }, validation.status, headers);
  const leadValue = validation.value;
  if (!turnstileToken || turnstileToken.length > 2048) {
    return json({ error: "bot verification required" }, 400, headers);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Cheap per-client quota runs before the external verification request. Use
  // only the gateway-appended rightmost forwarded hop as the client key.
  const clientIp = getClientIp(req);
  const preRateKey = await sha256(`${RATE_LIMIT_SALT}:pre-verification:${clientIp}`);
  const { data: preAllowed, error: preRateError } = await supabase.rpc("consume_lead_rate_limit", {
    p_key_hash: preRateKey,
    p_limit: 20,
    p_window_seconds: 60,
  });
  if (preRateError || preAllowed !== true) {
    if (preRateError) console.error("pre-verification lead rate limit failed", preRateError.code);
    return json({ error: preRateError ? "temporarily unavailable" : "too many requests" }, preRateError ? 503 : 429, headers);
  }

  const verified = await verifyTurnstile(turnstileToken, clientIp, TURNSTILE_SECRET);
  if (!verified) return json({ error: "bot verification failed" }, 403, headers);

  const rateKey = await sha256(`${RATE_LIMIT_SALT}:verified:${clientIp}`);
  const { data: allowed, error: rateError } = await supabase.rpc("consume_lead_rate_limit", {
    p_key_hash: rateKey,
    p_limit: 5,
    p_window_seconds: 900,
  });
  if (rateError) {
    console.error("lead rate limit failed", rateError.code);
    return json({ error: "temporarily unavailable" }, 503, headers);
  }
  if (allowed !== true) return json({ error: "too many requests" }, 429, headers);

  const { error: insertError } = await supabase
    .from("lead_submissions").insert({
      ...leadValue,
      raw_payload: {
        business_name: leadValue.business_name,
        lead_name: leadValue.lead_name,
        lead_phone: leadValue.lead_phone,
        lead_email: leadValue.lead_email,
        service_requested: leadValue.service_requested,
        urgency: leadValue.urgency,
        message: leadValue.message,
      },
    });

  if (insertError) {
    console.error("lead insert failed", insertError?.code);
    return json({ error: "could not submit lead" }, 500, headers);
  }

  return json({ ok: true }, 201, headers);
});

async function verifyTurnstile(token: string, remoteIp: string, secret: string): Promise<boolean> {
  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp !== "unknown") form.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;
    const result = await response.json() as TurnstileResult;
    return result.success === true
      && result.action === "lead-submit"
      && typeof result.hostname === "string"
      && TURNSTILE_HOSTNAMES.has(result.hostname.toLowerCase());
  } catch (error) {
    console.error("turnstile verification failed", error instanceof Error ? error.name : "unknown");
    return false;
  }
}

function getClientIp(req: Request): string {
  // Use only the gateway-appended rightmost X-Forwarded-For hop. Never trust
  // client-controlled CF-Connecting-IP/X-Real-IP or the leftmost forwarded hop.
  const hops = req.headers.get("x-forwarded-for")?.split(",").map((value) => value.trim()).filter(Boolean) || [];
  return hops.at(-1)?.slice(0, 64) || "unknown";
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function originAllowed(origin: string | null): boolean {
  return origin === null || ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://g7systems.xyz";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}
