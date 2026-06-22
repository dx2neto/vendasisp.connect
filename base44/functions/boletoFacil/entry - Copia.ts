import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

async function ixcPost(url, auth, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`,
      'ixcsoft': 'listar',
    },
    body: JSON.stringify({ oper: '=', page: '1', rp: '10', sortorder: 'asc', ...body }),
  });
  if (!res.ok) return { total: 0, registros: [] };
  return res.json().catch(() => ({ total: 0, registros: [] }));
}

Deno.serve(async (req) => {
  try {
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const { cpf_cnpj } = body;
    if (!cpf_cnpj) return Response.json({ erro: "Informe o CPF ou CNPJ." }, { status: 400 });

    const host = (Deno.env.get("IXC_HOST") || '').replace(/\/$/, '');
    const auth = Deno.env.get("IXC_AUTH_BASIC") || '';

    if (!host || !auth) return Response.json({ erro: "IXC não configurado." }, { status: 500 });

    const clienteUrl = `${host}/webservice/v1/cliente`;
    const cpf = cpf_cnpj.replace(/\D/g, '');

    // Busca cliente por CPF/CNPJ (campo correto: cnpj_cpf)
    const rCliente = await ixcPost(clienteUrl, auth, {
      qtype: 'cliente.cnpj_cpf',
      query: cpf,
      sortname: 'cliente.id',
    });

    const cliente = rCliente.registros?.[0];
    if (!cliente) {
      return Response.json({ erro: "Cliente não encontrado. Verifique o CPF/CNPJ informado." });
    }

    // Busca faturas em aberto do cliente
    const rFaturas = await ixcPost(`${host}/webservice/v1/fn_areceber`, auth, {
      qtype: 'fn_areceber.id_cliente',
      query: String(cliente.id),
      sortname: 'fn_areceber.data_vencimento',
    });

    const faturas = (rFaturas.registros || []).filter(f => f.status === 'A');
    const fatura = faturas[0];

    if (!fatura) {
      return Response.json({ nome: cliente.razao || cliente.nome_fantasia, sem_fatura: true });
    }

    // Formata data de vencimento (pode vir como data_vencimento ou vencimento)
    const dataVenc = fatura.data_vencimento || fatura.vencimento;
    const vencFormatado = dataVenc
      ? new Date(dataVenc + "T00:00:00").toLocaleDateString("pt-BR")
      : null;

    return Response.json({
      nome: cliente.razao || cliente.nome_fantasia || '',
      vencimento: vencFormatado,
      valor: fatura.valor,
      pix_copia_cola: fatura.pix_copia_cola || null,
      url_boleto: fatura.url_boleto || fatura.link_boleto || fatura.boleto_url || null,
      linha_digitavel: fatura.linha_digitavel || null,
    });

  } catch (error) {
    console.error("Erro boletoFacil:", error.message);
    return Response.json({ erro: "Erro ao consultar. Tente novamente." }, { status: 500 });
  }
});