// base44/shared/zapsignClient.ts
// Helper compartilhado para a API do ZapSign + gerador de PDF.
// SECRET: ZAPSIGN_TOKEN, ZAPSIGN_BASE (opcional)

import { PDFDocument, StandardFonts } from "npm:pdf-lib@1.17.1";

const ZAPSIGN_BASE = Deno.env.get("ZAPSIGN_BASE") || "https://api.zapsign.com.br/api/v1";
const ZAPSIGN_TOKEN = Deno.env.get("ZAPSIGN_TOKEN") || "";

export function zapsignConfigOk() {
  return Boolean(ZAPSIGN_TOKEN);
}

export const onlyDigits = (v: string) => (v ? String(v).replace(/\D/g, "") : "");

function sanitize(s: string) {
  return String(s || "")
    .replace(/→/g, "->").replace(/[""]/g, '"').replace(/['']/g, "'")
    .replace(/–|—/g, "-").replace(/•/g, "-").replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "");
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function textoParaPdfBase64(titulo: string, texto: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const A4 = [595.28, 841.89];
  const margin = 50;
  const maxWidth = A4[0] - margin * 2;
  const fontSize = 10;
  const lineHeight = 14;
  let page = pdf.addPage(A4);
  let y = A4[1] - margin;

  const drawLine = (text: string, f: any = font, size = fontSize) => {
    if (y < margin) { page = pdf.addPage(A4); y = A4[1] - margin; }
    page.drawText(text, { x: margin, y, size, font: f });
    y -= lineHeight;
  };

  const wrap = (line: string, f: any, size: number) => {
    const words = line.split(/\s+/);
    const out: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && cur) { out.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) out.push(cur);
    return out.length ? out : [""];
  };

  if (titulo) { drawLine(sanitize(titulo), bold, 14); y -= 6; }
  for (const raw of sanitize(texto).split("\n")) {
    if (raw.trim() === "") { y -= lineHeight / 2; continue; }
    for (const l of wrap(raw, font, fontSize)) drawLine(l);
  }

  const bytes = await pdf.save();
  return bytesToBase64(bytes);
}

export async function zapsignCriarDoc({ nome, base64_pdf, signers, external_id }: any) {
  const res = await fetch(`${ZAPSIGN_BASE}/docs/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ZAPSIGN_TOKEN}` },
    body: JSON.stringify({
      name: nome, base64_pdf, lang: "pt-br",
      external_id: external_id ? String(external_id) : undefined, signers,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.detail || JSON.stringify(data));
  return data;
}

export async function zapsignGetDoc(docToken: string) {
  const res = await fetch(`${ZAPSIGN_BASE}/docs/${docToken}/`, {
    headers: { Authorization: `Bearer ${ZAPSIGN_TOKEN}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || JSON.stringify(data));
  return data;
}