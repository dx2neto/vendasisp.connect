// Extrai a mensagem real de erro de chamadas a funções/entidades do Base44.
// O SDK (axios) coloca o corpo da resposta em err.response.data — é lá que está
// o motivo real (ex.: "ZAPSIGN_TOKEN não configurado"), enquanto err.message
// costuma ser só "Request failed with status code 500".
export function errorMessage(err, fallback = "Erro inesperado. Tente novamente.") {
  const body = err?.response?.data || err?.data || {};
  const msg = body.error || body.message || body.detalhe || err?.message;
  if (!msg) return fallback;
  // mensagem genérica do axios → tenta enriquecer com o status
  if (/request failed with status code/i.test(msg)) {
    const status = err?.response?.status;
    if (status === 500) return "Erro no servidor (500). Verifique se os secrets da integração estão configurados.";
    if (status === 401 || status === 403) return "Sem permissão para esta ação.";
    if (status === 404) return "Recurso não encontrado.";
    return `Falha na requisição${status ? ` (${status})` : ""}.`;
  }
  return msg;
}
