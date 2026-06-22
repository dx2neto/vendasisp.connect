import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Acesso restrito a administradores' }, { status: 403 });

    const { acao, instanceName, phone, webhookUrl } = await req.json();

    const EVOLUTION_URL = (Deno.env.get('EVOLUTION_URL') || '').replace(/\/$/, '');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_ID = Deno.env.get('EVOLUTION_INSTANCE_ID');

    if (!EVOLUTION_URL || !EVOLUTION_API_KEY) {
      return Response.json({ error: 'EVOLUTION_URL e EVOLUTION_API_KEY não configurados' }, { status: 400 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_KEY,
    };
    if (EVOLUTION_INSTANCE_ID) headers['instanceId'] = EVOLUTION_INSTANCE_ID;

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

    // === STATUS ===
    if (acao === 'status') {
      let instanceInfo = null;
      if (EVOLUTION_INSTANCE_ID) {
        const instResp = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
          method: 'GET',
          headers,
        });
        if (instResp.ok) {
          instanceInfo = await instResp.json().catch(() => null);
        }
      }
      return Response.json({
        ok: true,
        instance_id: EVOLUTION_INSTANCE_ID,
        instance: instanceInfo,
        status_local: statusRec,
      });
    }

    // === CRIAR INSTÂNCIA ===
    if (acao === 'criar') {
      const nome = instanceName || 'netveloce-atendimento';
      const resp = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
        body: JSON.stringify({
          instanceName: nome,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });
      const ret = await resp.json().catch(() => ({}));
      if (!resp.ok) return Response.json({ error: ret?.message || ret?.error || 'Erro ao criar instância' }, { status: 400 });

      // Atualiza status com novo instanceId
      await db.entities.EvolutionStatus.update(statusRec.id, {
        instance_id: ret.instance?.instanceId || ret.instanceId || '',
        instance_name: nome,
        status_conexao: 'desconectado',
        qr_code: '',
      });

      return Response.json({
        ok: true,
        instanceId: ret.instance?.instanceId || ret.instanceId,
        instanceName: nome,
        token: ret.instance?.token || ret.token,
        aviso: 'Anote o instanceId e configure no secret EVOLUTION_INSTANCE_ID',
      });
    }

    // === CONECTAR (gera QR Code) ===
    if (acao === 'conectar') {
      const body = {
        webhookUrl: webhookUrl || `${EVOLUTION_URL}/webhook`,
        subscribe: ['ALL'],
        immediate: true,
      };
      if (phone) body.phone = phone;

      const resp = await fetch(`${EVOLUTION_URL}/instance/connect`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const ret = await resp.json().catch(() => ({}));
      if (!resp.ok) return Response.json({ error: ret?.message || ret?.error || 'Erro ao conectar' }, { status: 400 });

      // Se vier QR code na resposta, atualiza
      const qr = ret.qrcode || ret.base64 || ret.qr || null;
      await db.entities.EvolutionStatus.update(statusRec.id, {
        status_conexao: qr ? 'aguardando_qr' : 'desconectado',
        qr_code: qr || '',
        ultimo_evento: 'connect_requested',
      });

      return Response.json({
        ok: true,
        qrcode: qr,
        pairingCode: ret.pairingCode || null,
        message: qr ? 'QR Code gerado. Escaneie com o WhatsApp.' : 'Aguardando QR Code via webhook...',
      });
    }

    // === DESCONECTAR ===
    if (acao === 'desconectar') {
      const resp = await fetch(`${EVOLUTION_URL}/instance/logout`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      const ret = await resp.json().catch(() => ({}));

      await db.entities.EvolutionStatus.update(statusRec.id, {
        status_conexao: 'desconectado',
        qr_code: '',
        phone_connected: '',
        ultimo_evento: 'logout',
      });

      return Response.json({ ok: true, resultado: ret });
    }

    // === BUSCAR QR CODE ATUAL ===
    if (acao === 'qr') {
      return Response.json({
        ok: true,
        qr_code: statusRec.qr_code || '',
        status: statusRec.status_conexao,
        phone: statusRec.phone_connected || '',
      });
    }

    // === DELETAR INSTÂNCIA ===
    if (acao === 'deletar') {
      const resp = await fetch(`${EVOLUTION_URL}/instance/delete`, {
        method: 'DELETE',
        headers,
      });
      const ret = await resp.json().catch(() => ({}));

      if (!resp.ok) return Response.json({ error: ret?.message || ret?.error || 'Erro ao deletar instância' }, { status: 400 });

      // Limpa dados locais
      await db.entities.EvolutionStatus.update(statusRec.id, {
        status_conexao: 'desconectado',
        instance_id: '',
        instance_name: '',
        phone_connected: '',
        qr_code: '',
        ultimo_evento: 'deleted',
      });

      return Response.json({ ok: true, message: 'Instância deletada com sucesso' });
    }

    return Response.json({ error: 'Ação inválida. Use: status, criar, conectar, desconectar, qr, deletar' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});