import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const { cpf_cnpj } = await req.json();
    if (!cpf_cnpj) return Response.json({ erro: "Informe o CPF ou CNPJ." }, { status: 400 });

    const host = Deno.env.get("IXC_HOST");
    const auth = Deno.env.get("IXC_AUTH_BASIC");

    // Busca cliente no IXC pelo CPF/CNPJ
    const clienteRes = await fetch(`${host}/webservice/v1/cliente?cpf_cnpj=${encodeURIComponent(cpf_cnpj)}&ativo=S&grid_param=[{"TB":"cliente.cpf_cnpj","OP":"=","P":"${cpf_cnpj}"}]&qty=1`, {
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }
    });
    const clienteData = await clienteRes.json();
    const cliente = clienteData?.registros?.[0];

    if (!cliente) {
      return Response.json({ erro: "Cliente não encontrado. Verifique o CPF/CNPJ informado." });
    }

    // Busca boletos em aberto
    const boletosRes = await fetch(`${host}/webservice/v1/fn_areceber?id_cliente=${cliente.id}&status=A&grid_param=[{"TB":"fn_areceber.id_cliente","OP":"=","P":"${cliente.id}"},{"TB":"fn_areceber.status","OP":"=","P":"A"}]&qty=5&order=vencimento ASC`, {
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }
    });
    const boletosData = await boletosRes.json();
    const boleto = boletosData?.registros?.[0];

    if (!boleto) {
      return Response.json({ nome: cliente.razao, sem_fatura: true });
    }

    // Formata data de vencimento
    const vencFormatado = boleto.vencimento
      ? new Date(boleto.vencimento + "T00:00:00").toLocaleDateString("pt-BR")
      : null;

    return Response.json({
      nome: cliente.razao,
      vencimento: vencFormatado,
      valor: boleto.valor,
      pix_copia_cola: boleto.pix_copia_cola || null,
      url_boleto: boleto.url_boleto || boleto.link_boleto || null,
      linha_digitavel: boleto.linha_digitavel || null,
    });

  } catch (error) {
    return Response.json({ erro: "Erro ao consultar. Tente novamente." }, { status: 500 });
  }
});