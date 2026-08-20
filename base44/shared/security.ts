// base44/shared/security.ts
// Módulo central de segurança: sanitização (XSS), rate limiting, criptografia,
// mascaramento de dados sensíveis (LGPD), validação de documentos e CSRF.
//
// O platform já cuida de JWT/sessões e SQL injection (SDK parametrizado).
// Este módulo complementa com proteções na camada de aplicação.

// ===================== SANITIZAÇÃO (XSS) =====================

const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /<object[^>]*>[\s\S]*?<\/object>/gi,
  /<embed[^>]*>/gi,
  /javascript:/gi,
  /on\w+\s*=\s*"[^"]*"/gi,
  /on\w+\s*=\s*'[^']*'/gi,
  /on\w+\s*=\s*[^\s>]+/gi,
  /<script[^>]*>/gi,
  /<\/script>/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
];

/**
 * Sanitiza uma string removendo vetores de XSS.
 */
export function sanitizeInput(value: string): string {
  if (!value || typeof value !== "string") return value;
  let sanitized = value;
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  // Remove caracteres de controle invisíveis
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return sanitized.trim();
}

/**
 * Sanitiza recursivamente todas as strings em um objeto.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return sanitizeInput(obj) as unknown as T;
  if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item)) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Não sanitizar campos que são URLs de arquivos ou JSON estruturado
      if (key === "file_url" || key === "signed_file_url" || key === "relatorio_pedido_url") {
        result[key] = value;
      } else {
        result[key] = sanitizeObject(value);
      }
    }
    return result as T;
  }
  return obj;
}

// ===================== RATE LIMITING =====================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limiting simples em memória (por IP ou identificador).
 * Retorna { allowed, remaining, resetAt }.
 */
export function rateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Limpa entradas expiradas do rate limiter (chamar periodicamente).
 */
export function cleanupRateLimit() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt < now) rateLimitStore.delete(key);
  }
}

// ===================== MASCARAMENTO (LGPD) =====================

/**
 * Mascara CPF: 123.456.789-00 → ***.456.789-**
 */
export function maskCPF(cpf: string): string {
  if (!cpf) return "";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "***.$2.$3-**");
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

/**
 * Mascara CNPJ: 12.345.678/0001-90 → **.345.678/****-**
 */
export function maskCNPJ(cnpj: string): string {
  if (!cnpj) return "";
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/****-**`;
}

/**
 * Mascara documento (CPF ou CNPJ) automaticamente.
 */
export function maskDocument(doc: string): string {
  if (!doc) return "";
  const digits = doc.replace(/\D/g, "");
  return digits.length <= 11 ? maskCPF(doc) : maskCNPJ(doc);
}

/**
 * Mascara email: usuario@dominio.com → u***@dominio.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email;
  const [user, domain] = email.split("@");
  return `${user[0]}***@${domain}`;
}

/**
 * Mascara telefone: 5511999990000 → +55 (11) ****-0000
 */
export function maskPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return phone;
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
}

/**
 * Anonimiza todos os dados sensíveis de um registro (LGPD - direito ao esquecimento).
 */
export function anonymizeRecord(record: Record<string, any>): Record<string, any> {
  const anonymized = { ...record };
  const sensitiveFields = [
    "nome", "razao", "cnpj_cpf", "cpf", "cnpj", "email", "telefone",
    "telefone_celular", "whatsapp", "rg", "ie_identidade", "customer_email",
    "customer_phone", "telefone_fixo", "lead_nome", "lead_cpf",
    "indicador_nome", "indicador_telefone", "indicador_email", "indicador_cpf",
    "indicado_nome", "indicado_telefone", "indicado_email",
    "nome_pai", "tel_pai", "nome_mae", "tel_mae",
    "nome_conjuge", "tel_conjuge", "cpf_conjuge",
    "nome_referencia", "tel_referencia",
  ];

  for (const field of sensitiveFields) {
    if (anonymized[field] !== undefined) {
      anonymized[field] = "ANONIMIZADO";
    }
  }

  // Anonimiza dados aninhados
  if (anonymized.install_address) {
    anonymized.install_address = {
      ...anonymized.install_address,
      endereco: "ANONIMIZADO",
      numero: "ANONIMIZADO",
      complemento: "ANONIMIZADO",
    };
  }
  if (anonymized.billing_address) {
    anonymized.billing_address = {
      ...anonymized.billing_address,
      endereco: "ANONIMIZADO",
      numero: "ANONIMIZADO",
      complemento: "ANONIMIZADO",
    };
  }
  if (anonymized.client_extra) {
    anonymized.client_extra = {
      ...anonymized.client_extra,
      profissao: "ANONIMIZADO",
      local_trabalho: "ANONIMIZADO",
      telefone_trabalho: "ANONIMIZADO",
    };
  }
  if (anonymized.extra_data) {
    anonymized.extra_data = {};
  }

  return anonymized;
}

// ===================== VALIDAÇÃO DE DOCUMENTOS =====================

/**
 * Valida CPF (algoritmo oficial).
 */
export function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[10])) return false;

  return true;
}

/**
 * Valida CNPJ (algoritmo oficial).
 */
export function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calc = (len: number) => {
    const weights = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(digits[i]) * weights[i];
    rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  let rest: number;
  if (calc(12) !== parseInt(digits[12])) return false;
  if (calc(13) !== parseInt(digits[13])) return false;

  return true;
}

/**
 * Valida CPF ou CNPJ automaticamente.
 */
export function validateDocument(doc: string): boolean {
  const digits = doc.replace(/\D/g, "");
  return digits.length <= 11 ? validateCPF(doc) : validateCNPJ(doc);
}

// ===================== CRIPTOGRAFIA =====================

/**
 * Criptografa um texto usando AES-GCM (Web Crypto API).
 * Retorna base64(iv + ciphertext).
 */
export async function encryptField(plaintext: string, keyHex: string): Promise<string> {
  if (!plaintext) return plaintext;
  const keyData = hexToArrayBuffer(keyHex);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return arrayBufferToBase64(combined.buffer);
}

/**
 * Descriptografa um texto (AES-GCM).
 */
export async function decryptField(ciphertextB64: string, keyHex: string): Promise<string> {
  if (!ciphertextB64) return ciphertextB64;
  const keyData = hexToArrayBuffer(keyHex);
  const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["decrypt"]);
  const combined = base64ToArrayBuffer(ciphertextB64);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ===================== CSRF =====================

const csrfStore = new Map<string, number>(); // token → expiry

/**
 * Gera um token CSRF aleatório.
 */
export function generateCSRFToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = arrayBufferToBase64(bytes.buffer).replace(/=/g, "");
  csrfStore.set(token, Date.now() + 3600000); // 1h
  return token;
}

/**
 * Valida um token CSRF.
 */
export function validateCSRFToken(token: string): boolean {
  if (!token) return false;
  const expiry = csrfStore.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    csrfStore.delete(token);
    return false;
  }
  return true;
}

/**
 * Consome (invalida) um token CSRF após uso.
 */
export function consumeCSRFToken(token: string): boolean {
  const valid = validateCSRFToken(token);
  if (valid) csrfStore.delete(token);
  return valid;
}

// ===================== AUDITORIA =====================

/**
 * Registra uma entrada de auditoria.
 */
export async function logAudit(base44: any, entry: {
  entity_type: string;
  entity_id?: string;
  action: string;
  changes?: any;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  ip_address?: string;
  user_agent?: string;
  reason?: string;
  sensitive?: boolean;
}) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      entity_type: entry.entity_type,
      entity_id: entry.entity_id || "",
      action: entry.action,
      changes: entry.changes || {},
      user_id: entry.user_id || "",
      user_name: entry.user_name || "",
      user_role: entry.user_role || "",
      ip_address: entry.ip_address || "",
      user_agent: entry.user_agent || "",
      reason: entry.reason || "",
      sensitive: entry.sensitive || false,
    });
  } catch (_) {
    // auditoria não deve quebrar fluxo
  }
}

/**
 * Extrai IP do request (com proxy awareness).
 */
export function getRequestIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * Extrai User-Agent do request.
 */
export function getRequestUserAgent(req: Request): string {
  return req.headers.get("user-agent") || "unknown";
}