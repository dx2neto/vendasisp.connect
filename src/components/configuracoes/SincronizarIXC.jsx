import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RefreshCw, Building2, Users, Wifi, ClipboardList, FolderOpen, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function SelectableList({ items, labelKey, idKey, onSelect, selected, placeholder }) {
  if (!items?.length) return <p className="text-xs text-muted-foreground italic">{placeholder || "Nenhum item"}</p>;
  return (
    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
      {items.map(item => (
        <button
          key={item[idKey]}
          type="button"
          onClick={() => onSelect && onSelect(String(item[idKey]))}
          className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-colors ${selected === String(item[idKey]) ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-primary/40 hover:bg-muted/50"}`}
        >
          <span className="font-mono text-muted-foreground mr-2">#{item[idKey]}</span>
          {item[labelKey] || item.nome || item.razao || item.login || item.descricao || "—"}
        </button>
      ))}
    </div>
  );
}

export default function SincronizarIXC() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: configs = [] } = useQuery({ queryKey: ["config"], queryFn: () => base44.entities.ConfigRegras.list() });
  const { data: planos = [] } = useQuery({ queryKey: ["planos"], queryFn: () => base44.entities.Plano.list() });
  const config = configs[0] || {};

  const [selecionado, setSelecionado] = useState({
    filial: config.id_filial_ixc || "",
    vendedor: config.id_vendedor_ixc_padrao || "",
    assunto: config.id_assunto_os_ixc || "",
    setor: config.id_setor_os_ixc || "",
  });

  // Plano -> ids IXC mapping
  const [planoMap, setPlanoMap] = useState({});

  const buscar = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("sincronizarIXC", {});
      setDados(res.data);
      setSelecionado({
        filial: config.id_filial_ixc || "",
        vendedor: config.id_vendedor_ixc_padrao || "",
        assunto: config.id_assunto_os_ixc || "",
        setor: config.id_setor_os_ixc || "",
      });
    } catch (e) {
      toast({ title: "Erro ao buscar dados do IXC", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const salvarConfig = useMutation({
    mutationFn: (data) => config.id
      ? base44.entities.ConfigRegras.update(config.id, data)
      : base44.entities.ConfigRegras.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast({ title: "Configurações IXC salvas!" });
    },
  });

  const salvarPlanoMutation = useMutation({
    mutationFn: async ({ planoId, id_modelo_ixc, id_produto_ixc }) => {
      await base44.entities.Plano.update(planoId, { id_modelo_ixc, id_produto_ixc });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planos"] });
      toast({ title: "Plano atualizado!" });
    },
  });

  const handleSalvarConfig = () => {
    salvarConfig.mutate({
      id_filial_ixc: selecionado.filial,
      id_vendedor_ixc_padrao: selecionado.vendedor,
      id_assunto_os_ixc: selecionado.assunto,
      id_setor_os_ixc: selecionado.setor,
    });
  };

  const handleSalvarPlano = (plano) => {
    const map = planoMap[plano.id] || {};
    salvarPlanoMutation.mutate({
      planoId: plano.id,
      id_modelo_ixc: map.modelo || plano.id_modelo_ixc || "",
      id_produto_ixc: map.produto || plano.id_produto_ixc || "",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Sincronização com IXC</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Busque dados do IXC e vincule aos recursos do CRM</p>
        </div>
        <Button onClick={buscar} disabled={loading} size="sm" className="gap-2 rounded-xl">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Buscar do IXC
        </Button>
      </div>

      {!dados && !loading && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
          Clique em "Buscar do IXC" para carregar filiais, vendedores, planos e mais.
        </div>
      )}

      {dados && (
        <div className="space-y-5">
          {/* Filiais */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-primary" /> Filiais</CardTitle>
              <CardDescription className="text-xs">Selecione a filial padrão para novos contratos</CardDescription>
            </CardHeader>
            <CardContent>
              <SelectableList
                items={dados.filiais}
                labelKey="razao"
                idKey="id"
                selected={selecionado.filial}
                onSelect={v => setSelecionado(s => ({ ...s, filial: v }))}
              />
              {selecionado.filial && <p className="text-xs text-primary mt-2">Selecionado: #{selecionado.filial}</p>}
            </CardContent>
          </Card>

          {/* Vendedores */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-primary" /> Vendedores</CardTitle>
              <CardDescription className="text-xs">Selecione o vendedor padrão no IXC</CardDescription>
            </CardHeader>
            <CardContent>
              <SelectableList
                items={dados.vendedores}
                labelKey="nome"
                idKey="id"
                selected={selecionado.vendedor}
                onSelect={v => setSelecionado(s => ({ ...s, vendedor: v }))}
              />
              {selecionado.vendedor && <p className="text-xs text-primary mt-2">Selecionado: #{selecionado.vendedor}</p>}
            </CardContent>
          </Card>

          {/* Assuntos OS */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm"><ClipboardList className="w-4 h-4 text-primary" /> Assuntos de OS</CardTitle>
              <CardDescription className="text-xs">Assunto padrão para OS de instalação</CardDescription>
            </CardHeader>
            <CardContent>
              <SelectableList
                items={dados.assuntos_os}
                labelKey="descricao"
                idKey="id"
                selected={selecionado.assunto}
                onSelect={v => setSelecionado(s => ({ ...s, assunto: v }))}
              />
              {selecionado.assunto && <p className="text-xs text-primary mt-2">Selecionado: #{selecionado.assunto}</p>}
            </CardContent>
          </Card>

          {/* Setores */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm"><FolderOpen className="w-4 h-4 text-primary" /> Setores</CardTitle>
              <CardDescription className="text-xs">Setor padrão para OS de instalação</CardDescription>
            </CardHeader>
            <CardContent>
              <SelectableList
                items={dados.setores_os}
                labelKey="setor"
                idKey="id"
                selected={selecionado.setor}
                onSelect={v => setSelecionado(s => ({ ...s, setor: v }))}
              />
              {selecionado.setor && <p className="text-xs text-primary mt-2">Selecionado: #{selecionado.setor}</p>}
            </CardContent>
          </Card>

          {/* Salvar config */}
          <div className="flex justify-end">
            <Button onClick={handleSalvarConfig} disabled={salvarConfig.isPending} className="gap-2 rounded-xl">
              {salvarConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Salvar Filial / Vendedor / OS
            </Button>
          </div>

          {/* Planos - vincular */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm"><Wifi className="w-4 h-4 text-primary" /> Vincular Planos ao IXC</CardTitle>
              <CardDescription className="text-xs">Associe cada plano do CRM a um modelo (radaccess) e produto no IXC</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {planos.map(plano => (
                <div key={plano.id} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{plano.nome}</p>
                    <div className="flex gap-2">
                      {plano.id_modelo_ixc && <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary">Modelo #{plano.id_modelo_ixc}</Badge>}
                      {plano.id_produto_ixc && <Badge variant="outline" className="text-[10px] bg-accent/10 text-accent">Produto #{plano.id_produto_ixc}</Badge>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">ID Modelo (radaccess)</Label>
                      <Input
                        value={planoMap[plano.id]?.modelo ?? plano.id_modelo_ixc ?? ""}
                        onChange={e => setPlanoMap(m => ({ ...m, [plano.id]: { ...(m[plano.id] || {}), modelo: e.target.value } }))}
                        placeholder="ex: 3"
                        className="rounded-xl h-8 text-xs"
                      />
                      {dados.planos_ixc?.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-0.5 mt-1">
                          {dados.planos_ixc.map(ix => (
                            <button
                              key={ix.id}
                              type="button"
                              onClick={() => setPlanoMap(m => ({ ...m, [plano.id]: { ...(m[plano.id] || {}), modelo: String(ix.id) } }))}
                              className={`w-full text-left text-[10px] px-2 py-1 rounded border transition-colors ${(planoMap[plano.id]?.modelo || plano.id_modelo_ixc) === String(ix.id) ? "border-primary bg-primary/5 text-primary" : "border-transparent hover:border-border hover:bg-muted/50 text-muted-foreground"}`}
                            >
                              #{ix.id} {ix.login || ix.nome || ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">ID Produto</Label>
                      <Input
                        value={planoMap[plano.id]?.produto ?? plano.id_produto_ixc ?? ""}
                        onChange={e => setPlanoMap(m => ({ ...m, [plano.id]: { ...(m[plano.id] || {}), produto: e.target.value } }))}
                        placeholder="ex: 5"
                        className="rounded-xl h-8 text-xs"
                      />
                      {dados.produtos_ixc?.length > 0 && (
                        <div className="max-h-32 overflow-y-auto space-y-0.5 mt-1">
                          {dados.produtos_ixc.map(ix => (
                            <button
                              key={ix.id}
                              type="button"
                              onClick={() => setPlanoMap(m => ({ ...m, [plano.id]: { ...(m[plano.id] || {}), produto: String(ix.id) } }))}
                              className={`w-full text-left text-[10px] px-2 py-1 rounded border transition-colors ${(planoMap[plano.id]?.produto || plano.id_produto_ixc) === String(ix.id) ? "border-primary bg-primary/5 text-primary" : "border-transparent hover:border-border hover:bg-muted/50 text-muted-foreground"}`}
                            >
                              #{ix.id} {ix.nome || ix.descricao || ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs h-7 gap-1"
                      onClick={() => handleSalvarPlano(plano)}
                      disabled={salvarPlanoMutation.isPending}
                    >
                      <CheckCircle className="w-3 h-3" /> Salvar plano
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}