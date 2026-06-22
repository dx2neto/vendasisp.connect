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

    const response = await fetch(`${zapsignUrl}docs/?page=1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      await response.json().catch(() => null);
      return Response.json({
        success: true,
        message: 'Conexão com ZapSign estabelecida com sucesso',
      });
    } else {
      return Response.json({ 
        success: false, 
        error: `Erro na autenticação: ${response.status}`,
        status: response.status
      }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});