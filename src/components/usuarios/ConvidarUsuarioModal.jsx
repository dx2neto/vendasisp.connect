import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLES } from "@/pages/GestaoUsuarios";
import { UserPlus, Mail, Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConvidarUsuarioModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("vendedor");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erro, setErro] = useState("");

  const handleConvidar = async () => {
    if (!email) return;
    setLoading(true);
    setErro("");
    try {
      await base44.users.inviteUser(email.trim().toLowerCase(), role);
      setSucesso(true);
    } catch (e) {
      setErro(e?.message || "Erro ao convidar usuário. Verifique o e-mail.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Convidar Novo Usuário
          </DialogTitle>
        </DialogHeader>

        {sucesso ? (
          <div className="py-6 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <p className="font-semibold text-base">Convite enviado!</p>
            <p className="text-sm text-muted-foreground">
              Um e-mail de convite foi enviado para <strong>{email}</strong> com papel de <strong>{ROLES.find(r => r.value === role)?.label}</strong>.
            </p>
            <Button className="mt-2 rounded-xl w-full" onClick={onClose}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                E-mail do usuário *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="usuario@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-9 rounded-xl"
                  onKeyDown={e => e.key === "Enter" && handleConvidar()}
                />
              </div>
            </div>

            {/* Papel */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Papel / Nível de Acesso *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => {
                  const Icon = r.icon;
                  const selected = role === r.value;
                  return (
                    <button
                      key={r.value}
                      onClick={() => setRole(r.value)}
                      className={cn(
                        "flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all",
                        selected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      )}
                    >
                      <Icon className={cn("w-4 h-4 mt-0.5 flex-shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                      <div className="min-w-0">
                        <p className={cn("text-sm font-semibold", selected ? "text-primary" : "")}>{r.label}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{r.desc}</p>
                      </div>
                      {selected && <Check className="w-3.5 h-3.5 text-primary ml-auto flex-shrink-0 mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Info do papel selecionado */}
            <div className="bg-muted/50 rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground">
                <strong>{ROLES.find(r => r.value === role)?.label}</strong>: {ROLES.find(r => r.value === role)?.desc}.
                O usuário receberá um e-mail com link de acesso.
              </p>
            </div>

            {erro && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 text-sm text-destructive">
                {erro}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1 rounded-xl gap-2"
                disabled={!email || loading}
                onClick={handleConvidar}
              >
                {loading
                  ? <><Zap className="w-4 h-4 animate-pulse" /> Enviando...</>
                  : <><UserPlus className="w-4 h-4" /> Enviar Convite</>
                }
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}