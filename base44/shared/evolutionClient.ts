// base44/shared/evolutionClient.ts
// Helper compartilhado para envio de WhatsApp via Evolution API.
//
// SECRETS:
//   EVOLUTION_URL            -> URL base da API (ex: https://evolution.example.com)
//   EVOLUTION_API_KEY        -> API key global
//   EVOLUTION_INSTANCE_TOKEN -> Token específico da instância (opcional, tem prioridade)
//
// A instância é resolvida em ordem: ConfigRegras.evo_instance > EvolutionStatus.instance_name

export async function enviarWhatsApp(
  base44: any,
  phone: string,
  text: string,
  linkPreview = false
): Promise<{ ok: boolean; error?: string }> {
  const phoneDigits = (phone || '').replace(/\D/g, '');
  if (!phoneDigits) return { ok: false, error: 'Telefone vazio' };

  const EVOLUTION_URL = (Deno.env.get('EVOLUTION_API_URL') || '').replace(/\/+$/, '');
  const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
  const EVOLUTION_INSTANCE_TOKEN = Deno.env.get('EVOLUTION_INSTANCE_TOKEN');

  let instanceName = '';
  try {
    const configs = await base44.asServiceRole.entities.ConfigRegras.list();
    instanceName = configs[0]?.evo_instance || '';
  } catch (_) { /* ignore */ }

  if (!instanceName) {
    try {
      const statuses = await base44.asServiceRole.entities.EvolutionStatus.list();
      instanceName = statuses[0]?.instance_name || '';
    } catch (_) { /* ignore */ }
  }

  if (!EVOLUTION_URL || (!EVOLUTION_INSTANCE_TOKEN && !EVOLUTION_API_KEY) || !instanceName) {
    console.warn('Evolution API não configurada — WhatsApp não enviado');
    return { ok: false, error: 'Evolution API não configurada' };
  }

  try {
    const resp = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_INSTANCE_TOKEN || EVOLUTION_API_KEY,
      },
      body: JSON.stringify({ number: phoneDigits, text, linkPreview }),
    });

    if (resp.ok) {
      console.log(`WhatsApp enviado para ${phoneDigits}`);
      return { ok: true };
    }

    const err = await resp.text().catch(() => '');
    console.warn(`Falha ao enviar WhatsApp para ${phoneDigits}: ${err}`);
    return { ok: false, error: err };
  } catch (e) {
    console.warn('Erro ao enviar WhatsApp:', (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}