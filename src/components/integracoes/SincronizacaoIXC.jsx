import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, Users, Building2, Wrench, FileText, Network, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const SYNC_ITEMS = [
  {
    key: "leads",
    label: "Clientes / Leads",
    icon: Users,
    description: "Importa clientes existentes do IXC como Leads no CRM",
    tipo: "sync_leads",
    color: "text-blue-600 bg-blue-50",
  },
  {
    key: "filiais",
    label: "Filiais",
    icon: Building2,
    description: "Lista filiais cadastradas no IXC",
    tipo: "filiais",
    color: "text-purple-600 bg-purple-50",
  },
  {
    key: "vendedores",
    label: "Vendedores",
    icon: Users,
    description: "Consulta vendedores cadastrados no IXC",
    tipo: "vendedores",
    color: "text-green-600 bg-green-50",
  },
  {
    key: "assuntos",
    label: "Assuntos de OS",
    icon: Wrench,
    description: "Lista assuntos disponíveis para ordens de serviço",
    tipo: "assuntos",
    color: "text-orange-600 bg-orange-50",
  },
  {
    key: "setores",
    label: "Setores de OS",
    icon: Network,
    description: "Setores responsáveis pelas ordens de serviço",
    tipo: "setores",
    color: "text-cyan-600 bg-cyan-50",
  },
  {
    key: "produtos",
    label: "Produtos / Planos",
    icon: Package,
    description: "Produtos e modelos de planos do IXC",
    tipo: "planos",
    color: "text-indigo-600 bg-indigo-50",
  },
  {
    key: "contratos",
    label: "Modelos de Contrato",
    icon: FileText,
    description: "Importa modelos de contrato do IXC para Templates",
    tipo: "sync_modelos",
    color: "text-rose-600 bg-rose-50",
  },
];

function ResultTable({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;
  const keys = Object.keys(data[0]).slice(0, 4);
  return (
    <div className="overflow-x-auto rounded-lg border border-border mt-2">
      <table className="w-full text-xs">
        <thead className="bg-muted/60">
          <tr>
            {keys.map(k => (
              <th key={k} className="px-3 py-2 text-left font-medium text-muted-foreground capitalize">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((row, i) => (
            <tr key={i} className="border-t border-border/50 hover:bg-muted/30">
              {keys.map(k => (
                <td key={k} className="px-3 py-2 truncate max-w-[180px]">{String(row[k] ?? "—")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 10 && (
        <div className="text-center text-xs text-muted-foreground py-2 border-t border-border/50">
          + {data.length - 10} mais registros
        </div>
      )}
    </div>
  );
}

function SyncCard({ item, onSync }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const Icon = item.icon;

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke("sincronizarIXC", { tipo: item.tipo });
      const data = res.data;
      setResult(data);
      setExpanded(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Extrai a lista relevante do resultado
  const getListData = () => {
    if (!result) return null;
    const candidates = [
      result.filiais,
      result.vendedores,
      result.planos_ixc,
      result.produtos_ixc,
      result.assuntos_os,
      result.setores_os,
    ];
    return candidates.find(c => Array.isArray(c) && c.length > 0) || null;
  };

  const getSummary = () => {
    if (!result) return null;
    if (result.leads_importados !== undefined) return `${result.leads_importados} importados, ${result.leads_existentes || 0} já existentes`;
    if (result.modelos_criados !== undefined) return `${result.modelos_criados?.length || 0} criados, ${result.modelos_atualizados?.length || 0} atualizados`;
    const list = getListData();
    if (list) return `${list.length} registros encontrados`;
    return "Concluído";
  };

  const listData = getListData();

  return (
    <Card className="rounded-2xl border border-border overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", item.color)}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{item.label}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
          </div>
          {result && (
            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 border text-xs flex-shrink-0">
              <CheckCircle className="w-3 h-3 mr-1" /> OK
            </Badge>
          )}
          {error && (
            <Badge className="bg-red-50 text-red-500 border-red-200 border text-xs flex-shrink-0">
              <XCircle className="w-3 h-3 mr-1" /> Erro
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {result && (
          <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 font-medium">
            ✓ {getSummary()}
          </div>
        )}
        {error && (
          <div className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {result && listData && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 justify-end"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Ocultar" : "Ver dados"}
          </button>
        )}

        {expanded && listData && <ResultTable data={listData} />}

        {expanded && result?.modelos_criados?.length > 0 && (
          <div className="text-xs bg-muted/40 rounded-lg p-3">
            <p className="font-medium mb-1">Criados:</p>
            {result.modelos_criados.slice(0, 5).map((m, i) => (
              <p key={i} className="text-muted-foreground">• {m.nome} (IXC #{m.id_ixc})</p>
            ))}
            {result.modelos_criados.length > 5 && <p className="text-muted-foreground">+{result.modelos_criados.length - 5} mais...</p>}
          </div>
        )}

        <Button
          size="sm"
          variant={result ? "outline" : "default"}
          className="w-full gap-2 rounded-xl"
          onClick={handleSync}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sincronizando...</>
          ) : (
            <><RefreshCw className="w-3.5 h-3.5" /> {result ? "Sincronizar novamente" : "Sincronizar"}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function SincronizacaoIXC() {
  const [syncingAll, setSyncingAll] = useState(false);
  const [allResults, setAllResults] = useState(null);

  const syncAll = async () => {
    setSyncingAll(true);
    setAllResults(null);
    try {
      // Sincroniza em paralelo os tipos de consulta (sem importação)
      const [filiais, vendedores, assuntos, setores, produtos] = await Promise.all([
        base44.functions.invoke("sincronizarIXC", { tipo: "filiais" }),
        base44.functions.invoke("sincronizarIXC", { tipo: "vendedores" }),
        base44.functions.invoke("sincronizarIXC", { tipo: "assuntos" }),
        base44.functions.invoke("sincronizarIXC", { tipo: "setores" }),
        base44.functions.invoke("sincronizarIXC", { tipo: "planos" }),
      ]);
      setAllResults({
        filiais: filiais.data?.filiais?.length || 0,
        vendedores: vendedores.data?.vendedores?.length || 0,
        assuntos: assuntos.data?.assuntos_os?.length || 0,
        setores: setores.data?.setores_os?.length || 0,
        produtos: produtos.data?.planos_ixc?.length || 0,
      });
    } catch (e) {
      setAllResults({ erro: e.message });
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Sincronização com IXC</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Clique em cada item para buscar e importar dados do IXC</p>
        </div>
        <Button size="sm" variant="outline" className="gap-2 rounded-xl" onClick={syncAll} disabled={syncingAll}>
          {syncingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Consultar tudo
        </Button>
      </div>

      {allResults && !allResults.erro && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(allResults).map(([k, v]) => (
            <div key={k} className="bg-muted/40 rounded-xl px-3 py-2 text-center">
              <p className="text-lg font-bold">{v}</p>
              <p className="text-xs text-muted-foreground capitalize">{k}</p>
            </div>
          ))}
        </div>
      )}

      {allResults?.erro && (
        <div className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">{allResults.erro}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SYNC_ITEMS.map(item => (
          <SyncCard key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}