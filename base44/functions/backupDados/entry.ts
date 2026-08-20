// base44/functions/backupDados/entry.ts
// Backup completo de dados do CRM: exporta todas as entidades em formato JSON.
// Protege contra perda de dados e atende requisitos LGPD de portabilidade.

import { createClientFromRequest } from "npm:@base44/sdk";

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const ENTITIES_TO_BACKUP = [
  "Lead",
  "Pedido",
  "Plano",
  "Coupon",
  "Comissao",
  "AnaliseCredito",
  "TemplateContrato",
  "Contrato",
  "Viabilidade",
  "MetaVendedor",
  "Indicacao",
  "ConfigReferral",
  "Contato",
  "Conversa",
  "Mensagem",
  "Setor",
  "RespostaRapida",
  "SiteConfig",
  "ConfigRegras",
  "SyncQueue",
  "IntegrationLog",
  "AuditLog",
  "LGPDConsentimento",
  "ErrorLog",
];

export default async function handler(req: Request) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const base44 = createClientFromRequest(req);

  try {
    const backup: Record<string, any> = {
      _metadata: {
        timestamp: new Date().toISOString(),
        app: "BaseSales Pro",
        version: "1.0",
        entities_count: ENTITIES_TO_BACKUP.length,
      },
    };

    let totalRecords = 0;

    for (const entity of ENTITIES_TO_BACKUP) {
      try {
        const records = await base44.asServiceRole.entities[entity].list("-created_date", 10000);
        backup[entity] = records;
        totalRecords += records.length;
      } catch (e: any) {
        backup[entity] = { _error: e.message };
      }
    }

    backup._metadata.total_records = totalRecords;

    return json({
      status: "success",
      backup_date: backup._metadata.timestamp,
      entities: ENTITIES_TO_BACKUP.length,
      total_records: totalRecords,
      data: backup,
    });
  } catch (e: any) {
    return json({ error: e.message || "Erro ao gerar backup" }, 500);
  }
}