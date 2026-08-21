import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plug, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const CATEGORY_LABEL = {
  signature: "Assinatura Digital",
  erp: "ERP / CRM",
  whatsapp: "WhatsApp",
  ai: "Inteligência Artificial",
  payment: "Pagamento",
};

const CATEGORY_COLOR = {
  signature: "bg-blue-50 text-blue-600 border-blue-200",
  erp: "bg-purple-50 text-purple-600 border-purple-200",
  whatsapp: "bg-emerald-50 text-emerald-600 border-emerald-200",
  ai: "bg-amber-50 text-amber-600 border-amber-200",
  payment: "bg-rose-50 text-rose-600 border-rose-200",
};

export default function Integrations() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["integration-hub"],
    queryFn: () => base44.entities.Integration.list("-created_date", 100),
  });

  const toggleEnabled = async (integration) => {
    await base44.entities.Integration.update(integration.id, { enabled: !integration.enabled });
    queryClient.invalidateQueries({ queryKey: ["integration-hub"] });
  };

  const filtered = integrations.filter(
    (i) =>
      i.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.slug?.toLowerCase().includes(search.toLowerCase())
  );

  const enabledCount = integrations.filter((i) => i.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plug className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Integration Hub</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-10">
            {enabledCount} de {integrations.length} integrações ativas
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar integração..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((integration) => (
            <Card key={integration.id} className="rounded-2xl border border-border hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{integration.display_name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{integration.slug}</p>
                  </div>
                  <Switch
                    checked={!!integration.enabled}
                    onCheckedChange={() => toggleEnabled(integration)}
                  />
                </div>

                <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-[2rem]">
                  {integration.description || "—"}
                </p>

                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {integration.category && (
                    <Badge variant="outline" className={`text-xs ${CATEGORY_COLOR[integration.category] || ""}`}>
                      {CATEGORY_LABEL[integration.category] || integration.category}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {integration.environment === "sandbox" ? "Sandbox" : "Produção"}
                  </Badge>
                  {integration.has_webhook && (
                    <Badge variant="outline" className="text-xs bg-cyan-50 text-cyan-600 border-cyan-200">
                      Webhook
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-xs">
                    {integration.enabled ? (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ativa
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" /> Inativa
                      </span>
                    )}
                  </span>
                  <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <Link to={`/integrations/${integration.slug}`}>
                      Configurar <ChevronRight className="w-3 h-3" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="py-16 text-center text-muted-foreground">
          <Plug className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p>Nenhuma integração encontrada.</p>
        </div>
      )}
    </div>
  );
}