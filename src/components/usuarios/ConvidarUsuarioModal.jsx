import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLES } from "@/pages/GestaoUsuarios";
import { UserPlus, Mail, Check, Zap, Eye, EyeOff, User } from "lucide-react";
import { cn } from "@/lib/utils";

function RoleSelector({ role, setRole }) {
  return (
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
                selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
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
  );
}

function Sucesso({ tipo, email, nome, role, onNovoUsuario, onClose }) {
  return (
    <div className="py-6 flex flex-col items-center gap-3 text-center">
      <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
        <Check className="w-7 h-7 text-emerald-600" />
      </div>
      <p className="font-semibold text-base">
        {tipo === "convite" ? "Convite enviado!" : "Usuário criado!"}
      </p>
      <p className="text-sm text-muted-foreground">
        {tipo === "convite"
          ? <>E-mail de convite enviado para <strong>{email}</strong> com papel de <strong>{ROLES.find(r => r.value === role)?.label}</strong>.</>
          : <><strong>{nome}</strong> foi criado com papel de <strong>{ROLES.find(r => r.value === role)?.label}</strong>. O usuário pode fazer login com o e-mail e senha definidos.</>
        }
      </p>
      <div className="flex gap-2 mt-2 w-full">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onNovoUsuario}>+ Outro</Button>
        <Button className="flex-1 rounded-xl" onClick={onClose}>Fechar</Button>
      </div>
    </div>
  );
}

export default function ConvidarUsuarioModal({ onClose }) {
  const [aba, setAba] = useState("criar"); // "criar" | "convidar"
  const [role, setRole] = useState("vendedor");
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(null); // { tipo, email, nome }
  const [erro, setErro] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Criar usuário
  const [form, setForm] = useState({ nome: "", email: "", senha: "" });
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Convidar
  const [emailConvite, setEmailConvite] = useState("");

  const resetar = () => {
    setForm({ nome: "", email: "", senha: "" });
    setEmailConvite("");
    setSucesso(null);
    setErro("");
  };

  const handleCriar = async () => {
    if (!form.nome || !form.email || !form.senha) return;
    if (form.senha.length < 6) { setErro("A senha deve ter pelo menos 6 caracteres."); return; }
    setLoading(true);
    setErro("");
    try {
      await base44.auth.register({ email: form.email.trim().toLowerCase(), password: form.senha, full_name: form.nome.trim(), role });
      setSucesso({ tipo: "criar", nome: form.nome, email: form.email });
    } catch (e) {
      setErro(e?.message || "Erro ao criar usuário. Verifique os dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleConvidar = async () => {
    if (!emailConvite) return;
    setLoading(true);
    setErro("");
    try {
      await base44.users.inviteUser(emailConvite.trim().toLowerCase(), role);
      setSucesso({ tipo: "convite", email: emailConvite });
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
            Adicionar Usuário
          </DialogTitle>
        </DialogHeader>

        {sucesso ? (
          <Sucesso {...sucesso} role={role} onNovoUsuario={resetar} onClose={onClose} />
        ) : (
          <div className="space-y-5 mt-2">
            {/* Abas */}
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              <button
                onClick={() => { setAba("criar"); setErro(""); }}
                className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                  aba === "criar" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <User className="w-3.5 h-3.5" /> Criar Usuário
              </button>
              <button
                onClick={() => { setAba("convidar"); setErro(""); }}
                className={cn("flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5",
                  aba === "convidar" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                <Mail className="w-3.5 h-3.5" /> Enviar Convite
              </button>
            </div>

            {/* ── CRIAR USUÁRIO ── */}
            {aba === "criar" && (
              <>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nome completo *</label>
                    <Input
                      placeholder="João da Silva"
                      value={form.nome}
                      onChange={e => setF("nome", e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">E-mail *</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="usuario@empresa.com"
                        value={form.email}
                        onChange={e => setF("email", e.target.value)}
                        className="pl-9 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Senha *</label>
                    <div className="relative">
                      <Input
                        type={mostrarSenha ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={form.senha}
                        onChange={e => setF("senha", e.target.value)}
                        className="pr-10 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <RoleSelector role={role} setRole={setRole} />

                {erro && <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 text-sm text-destructive">{erro}</div>}

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
                  <Button
                    className="flex-1 rounded-xl gap-2"
                    disabled={!form.nome || !form.email || !form.senha || loading}
                    onClick={handleCriar}
                  >
                    {loading ? <><Zap className="w-4 h-4 animate-pulse" /> Criando...</> : <><UserPlus className="w-4 h-4" /> Criar Usuário</>}
                  </Button>
                </div>
              </>
            )}

            {/* ── ENVIAR CONVITE ── */}
            {aba === "convidar" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">E-mail do usuário *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="usuario@empresa.com"
                      value={emailConvite}
                      onChange={e => setEmailConvite(e.target.value)}
                      className="pl-9 rounded-xl"
                      onKeyDown={e => e.key === "Enter" && handleConvidar()}
                    />
                  </div>
                </div>

                <RoleSelector role={role} setRole={setRole} />

                <div className="bg-muted/50 rounded-xl px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    O usuário receberá um <strong>e-mail de convite</strong> com link para criar sua própria senha.
                  </p>
                </div>

                {erro && <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5 text-sm text-destructive">{erro}</div>}

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose}>Cancelar</Button>
                  <Button
                    className="flex-1 rounded-xl gap-2"
                    disabled={!emailConvite || loading}
                    onClick={handleConvidar}
                  >
                    {loading ? <><Zap className="w-4 h-4 animate-pulse" /> Enviando...</> : <><Mail className="w-4 h-4" /> Enviar Convite</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}