import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const evolutionError = (data, fallback) =>
  data?.error?.message || data?.error || data?.message || fallback;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });

    const { acao, instanceName, instanceToken, proxy, phone, webhookUrl, subscribe } = await req.json();

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_ID = Deno.env.get('EVOLUTION_INSTANCE_ID');
    const EVOLUTION_INSTANCE_TOKEN = Deno.env.get('EVOLUTION_INSTANCE_TOKEN');

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return Response.json({ error: 'EVOLUTION_URL e EVOLUTION_API_KEY não configurados' }, { status: 400 });
    }

    const db = base44.asServiceRole;

    // Busca ou cria registro de status
    const statusList = await db.entities.EvolutionStatus.list();
    let statusRec = statusList[0];
    if (!statusRec) {
      statusRec = await db.entities.EvolutionStatus.create({
        status_conexao: 'desconectado',
        instance_id: EVOLUTION_INSTANCE_ID || '',
      });
    }

    // A newly created instance is persisted in EvolutionStatus. Reuse it
    // immediately instead of requiring a secret update and a new deployment.
    const instanceId = EVOLUTION_INSTANCE_ID || statusRec.instance_id || '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_INSTANCE_TOKEN || EVOLUTION_API_KEY,
    };
    // Compatibility fallback for servers that also accept the instance UUID.
    if (instanceId) headers.instanceId = instanceId;

    // === STATUS ===
    if (acao === 'status') {
      let instanceInfo = null;
      const instResp = await fetch(`${EVOLUTION_URL}/instance/all`, {
        method: 'GET',
        headers: { apikey: EVOLUTION_API_KEY },
      });
      const remote = await instResp.json().catch(() => ({}));
      if (!instResp.ok) return Response.json({ error: evolutionError(remote, `Evolution respondeu HTTP ${instResp.status}`) }, { status: instResp.status });
      const instances = Array.isArray(remote?.data) ? remote.data : Array.isArray(remote) ? remote : [];
      instanceInfo = instanceId
        ? instances.find((item) => item.id === instanceId || item.name === instanceId) || null
        : null;
      return Response.json({
        ok: true,
        instance_id: instanceId || null,
        instance: instanceInfo,
        instances,
        status_local: statusRec,
      });
    }

    // === CRIAR INSTÂNCIA ===
    if (acao === 'criar') {
      const nome = instanceName || 'netveloce-atendimento';
      const token = instanceToken || Deno.env.get('EVOLUTION_INSTANCE_TOKEN') || crypto.randomUUID();
      const createBody: Record<string, unknown> = { name: nome, token };
      if (proxy && typeof proxy === 'object' && proxy.address) {
        createBody.proxy = {
          address: proxy.address,
          port: String(proxy.port || ''),
          username: proxy.username || '',
          password: proxy.password || '',
        };
      }
      const resp = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify(createBody),
      });
      const ret = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return Response.json({
          error: evolutionError(ret, `Erro ao criar instância (HTTP ${resp.status})`),
          detalhe: ret,
        }, { status: resp.status });
      }

      const created = ret?.data || ret?.instance || ret;
      const createdId = created?.id || created?.instanceId || ret?.instanceId || '';
      const createdName = created?.name || nome;
      const createdToken = created?.token || token;

      // Atualiza status com novo instanceId
      await db.entities.EvolutionStatus.update(statusRec.id, {
        instance_id: createdId,
        instance_name: createdName,
        status_conexao: 'desconectado',
        qr_code: '',
      });

      return Response.json({
        ok: true,
        instanceId: createdId,
        instanceName: createdName,
        token: createdToken,
        aviso: createdId
          ? 'Instância criada e vinculada ao CRM.'
          : 'Instância criada, mas a API não retornou o ID esperado.',
      });
    }

    // === CONECTAR (gera QR Code) ===
    if (acao === 'conectar') {
      if (!instanceId) {
        return Response.json({ error: 'Crie uma instância ou configure EVOLUTION_INSTANCE_ID antes de conectar' }, { status: 400 });
      }
      const resolvedWebhook = Deno.env.get('EVOLUTION_WEBHOOK_URL') || webhookUrl || '';
      if (!resolvedWebhook) {
        return Response.json({ error: 'Configure EVOLUTION_WEBHOOK_URL antes de conectar' }, { status: 400 });
      }
      const selectedEvents = Array.isArray(subscribe) && subscribe.length ? subscribe : ['ALL'];
      const body: Record<string, unknown> = {
        webhookUrl: resolvedWebhook,
        subscribe: selectedEvents,
        immediate: true,
      };
      if (phone) body.phone = phone;

      const resp = await fetch(`${EVOLUTION_URL}/instance/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const ret = await resp.json().catch(() => ({}));
      if (!resp.ok) return Response.json({ error: evolutionError(ret, `Erro ao conectar (HTTP ${resp.status})`) }, { status: resp.status });

      let pairingCode = null;
      if (phone) {
        const pairResp = await fetch(`${EVOLUTION_URL}/instance/pair`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone, subscribe: selectedEvents }),
        });
        const pairData = await pairResp.json().catch(() => ({}));
        if (!pairResp.ok) return Response.json({ error: evolutionError(pairData, `Erro ao solicitar pareamento (HTTP ${pairResp.status})`) }, { status: pairResp.status });
        pairingCode = pairData?.data?.PairingCode || pairData?.PairingCode || pairData?.pairingCode || null;
      }

      await db.entities.EvolutionStatus.update(statusRec.id, {
        status_conexao: 'aguardando_qr',
        qr_code: '',
        ultimo_evento: 'connect_requested',
      });

      return Response.json({
        ok: true,
        qrcode: null,
        pairingCode,
        message: pairingCode ? 'Código de pareamento gerado.' : 'Conexão iniciada. Consulte o QR Code.',
      });
    }

    // === DESCONECTAR ===
    if (acao === 'desconectar') {
      if (!instanceId) return Response.json({ error: 'Instância Evolution não configurada' }, { status: 400 });
      const resp = await fetch(`${EVOLUTION_URL}/instance/disconnect`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const ret = await resp.json().catch(() => ({}));

      if (!resp.ok) return Response.json({ error: evolutionError(ret, `Erro ao desconectar (HTTP ${resp.status})`) }, { status: resp.status });

      await db.entities.EvolutionStatus.update(statusRec.id, {
        status_conexao: 'desconectado',
        qr_code: '',
        phone_connected: '',
        ultimo_evento: 'disconnect',
      });

      return Response.json({ ok: true, resultado: ret });
    }

    // === BUSCAR QR CODE ATUAL ===
    if (acao === 'qr') {
      if (!instanceId) return Response.json({ error: 'Instância Evolution não configurada' }, { status: 400 });
      const resp = await fetch(`${EVOLUTION_URL}/instance/qr`, { method: 'GET', headers });
      const ret = await resp.json().catch(() => ({}));
      if (!resp.ok) return Response.json({ error: evolutionError(ret, `Erro ao obter QR Code (HTTP ${resp.status})`) }, { status: resp.status });
      const qr = ret?.data?.Qrcode || ret?.data?.qrcode || ret?.Qrcode || ret?.qrcode || statusRec.qr_code || '';
      if (qr && qr !== statusRec.qr_code) {
        await db.entities.EvolutionStatus.update(statusRec.id, { qr_code: qr, status_conexao: 'aguardando_qr' });
      }
      return Response.json({
        ok: true,
        qr_code: qr,
        code: ret?.data?.Code || ret?.data?.code || null,
        status: statusRec.status_conexao,
        phone: statusRec.phone_connected || '',
      });
    }

    // === LOGOUT (remove a sessão do WhatsApp) ===
    if (acao === 'logout') {
      if (!instanceId) return Response.json({ error: 'Instância Evolution não configurada' }, { status: 400 });
      const resp = await fetch(`${EVOLUTION_URL}/instance/logout`, { method: 'DELETE', headers });
      const ret = await resp.json().catch(() => ({}));
      if (!resp.ok) return Response.json({ error: evolutionError(ret, `Erro ao fazer logout (HTTP ${resp.status})`) }, { status: resp.status });
      await db.entities.EvolutionStatus.update(statusRec.id, {
        status_conexao: 'desconectado', qr_code: '', phone_connected: '', ultimo_evento: 'logout',
      });
      return Response.json({ ok: true, resultado: ret });
    }

    // === DELETAR INSTÂNCIA ===
    if (acao === 'deletar') {
      if (!instanceId) return Response.json({ error: 'Instância Evolution não configurada' }, { status: 400 });
      const resp = await fetch(`${EVOLUTION_URL}/instance/delete/${encodeURIComponent(instanceId)}`, {
        method: 'DELETE',
        headers: { apikey: EVOLUTION_API_KEY },
      });
      const ret = await resp.json().catch(() => ({}));
      if (!resp.ok) return Response.json({ error: evolutionError(ret, `Erro ao excluir instância (HTTP ${resp.status})`) }, { status: resp.status });
      await db.entities.EvolutionStatus.update(statusRec.id, {
        status_conexao: 'desconectado', instance_id: '', instance_name: '', qr_code: '', phone_connected: '', ultimo_evento: 'deleted',
      });
      return Response.json({ ok: true, resultado: ret });
    }

    if (acao === 'listar') {
      const resp = await fetch(`${EVOLUTION_URL}/instance/all`, { method: 'GET', headers: { apikey: EVOLUTION_API_KEY } });
      const ret = await resp.json().catch(() => ({}));
      if (!resp.ok) return Response.json({ error: evolutionError(ret, `Erro ao listar instâncias (HTTP ${resp.status})`) }, { status: resp.status });
      return Response.json({ ok: true, instances: Array.isArray(ret?.data) ? ret.data : [] });
    }

    return Response.json({ error: 'Ação inválida. Use: status, criar, conectar, desconectar, logout, qr, listar, deletar' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
