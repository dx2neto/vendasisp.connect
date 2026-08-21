// base44/shared/otpAuth.ts
// OTP + session token authentication for Central do Assinante.
// Stateless (HMAC-SHA256 signed tokens) — works on serverless.
// Uses GLOBAL_API_KEY as signing secret.

const OTP_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

function getSigningKey(): string {
  return Deno.env.get("GLOBAL_API_KEY") || "central-do-assinante-dev-key";
}

function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSha256(message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSigningKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(new Uint8Array(hash));
}

export function generateOTP(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = "";
  for (const b of bytes) code += (b % 10).toString();
  return code.slice(0, 6);
}

async function signToken(payload: Record<string, any>): Promise<string> {
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(new TextEncoder().encode(payloadStr));
  const sig = await hmacSha256(payloadB64);
  const sigB64 = base64urlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

async function verifyToken(token: string): Promise<Record<string, any> | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedSig = await hmacSha256(payloadB64);
  const expectedSigB64 = base64urlEncode(expectedSig);
  if (sigB64 !== expectedSigB64) return null;
  try {
    const bytes = base64urlDecode(payloadB64);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export async function createOTPToken(cpf: string, otp: string): Promise<string> {
  return signToken({
    type: "otp",
    cpf_hash: await sha256(cpf.replace(/\D/g, "")),
    otp_hash: await sha256(otp),
    exp: Date.now() + OTP_TOKEN_EXPIRY_MS,
  });
}

export async function validateOTPToken(
  token: string,
  cpf: string,
  otp: string
): Promise<{ valid: boolean; reason?: string }> {
  const payload = await verifyToken(token);
  if (!payload) return { valid: false, reason: "Token inválido" };
  if (payload.type !== "otp") return { valid: false, reason: "Tipo de token incorreto" };
  if (Date.now() > payload.exp) return { valid: false, reason: "Token expirado" };
  const cpfHash = await sha256(cpf.replace(/\D/g, ""));
  if (payload.cpf_hash !== cpfHash) return { valid: false, reason: "CPF não corresponde" };
  const otpHash = await sha256(otp);
  if (payload.otp_hash !== otpHash) return { valid: false, reason: "Código OTP inválido" };
  return { valid: true };
}

export async function createSessionToken(cpf: string): Promise<string> {
  return signToken({
    type: "session",
    cpf_hash: await sha256(cpf.replace(/\D/g, "")),
    exp: Date.now() + SESSION_TOKEN_EXPIRY_MS,
  });
}

export async function validateSessionToken(
  token: string,
  cpf: string
): Promise<{ valid: boolean; reason?: string }> {
  const payload = await verifyToken(token);
  if (!payload) return { valid: false, reason: "Token inválido" };
  if (payload.type !== "session") return { valid: false, reason: "Tipo de token incorreto" };
  if (Date.now() > payload.exp) return { valid: false, reason: "Sessão expirada" };
  const cpfHash = await sha256(cpf.replace(/\D/g, ""));
  if (payload.cpf_hash !== cpfHash) return { valid: false, reason: "CPF não corresponde ao token" };
  return { valid: true };
}

/** Normalize Brazilian phone to 55+DDD+numero format for WhatsApp */
export function normalizePhoneBR(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) {
    digits = "55" + digits;
  }
  if (digits.length < 12 || digits.length > 13) return "";
  return digits;
}

/** Mask phone for display: 5534999990000 → (34) ***-***-0000 */
export function maskPhoneBR(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length < 8) return phone || "";
  const last4 = digits.slice(-4);
  const ddd = digits.length >= 10 ? digits.slice(-10, -8) : "";
  return ddd ? `(${ddd}) ***-***-${last4}` : `***-***-${last4}`;
}