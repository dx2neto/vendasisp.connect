import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = Deno.env.get('ZAPSIGN_TOKEN');
    if (!token) {
      return Response.json({ error: 'Token ZapSign não configurado' }, { status: 400 });
    }

    const config = await base44.entities.ConfigRegras.list();
    const zapsignUrl = config[0]?.zapsign_url_api || 'https://api.zapsign.com.br/api/v1/';

    // Buscar contratos com status "enviado" ou "gerado"
    const contratos = await base44.entities.Contrato.filter({});
    const pendentes = contratos.filter(c => c.status === 'enviado' || c.status === 'gerado');

    let sincronizados = 0;
    const resultados = [];

    for (const contrato of pendentes) {
      try {
        // Buscar status do documento no ZapSign
        if (contrato.id_zapsign) {
          const response = await fetch(`${zapsignUrl}docs/${contrato.id_zapsign}/`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const docData = await response.json();
            
            // Verificar se foi assinado
            if (docData.status === 'signed' || docData.signed_at) {
              await base44.entities.Contrato.update(contrato.id, {
                status: 'assinado',
                data_assinatura: docData.signed_at || new Date().toISOString(),
              });
              sincronizados++;
              resultados.push({ id: contrato.id, status: 'assinado' });
            }
          }
        }
      } catch (error) {
        resultados.push({ id: contrato.id, error: error.message });
      }
    }

    return Response.json({ 
      success: true, 
      message: `${sincronizados} contratos sincronizados`,
      sincronizados,
      total: pendentes.length,
      resultados
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});