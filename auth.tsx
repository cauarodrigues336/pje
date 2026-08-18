import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { usernameToEmail } from "@/lib/pje";
import { ShieldCheck, IdCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — PJe" }] }),
  component: AuthPage,
});

const loginSchema = z.object({
  username: z.string().trim().min(1, "Informe o número de usuário").max(60),
  password: z.string().min(1, "Informe a senha").max(72),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: "/painel" });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12 md:py-16 text-center">
          <div className="mx-auto size-24 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="size-12" />
          </div>
          <h1 className="mt-6 text-3xl md:text-4xl font-normal text-primary">
            Processo Judicial Eletrônico
          </h1>
          <p className="mt-1 text-lg md:text-xl text-muted-foreground">Poder Judiciário</p>

          <div className="mt-8 bg-card border border-border rounded-md shadow-sm">
            <div className="grid md:grid-cols-[1fr_auto_1fr] items-center gap-6 p-6 md:p-10 text-left">
              <div className="text-center">
                <p className="text-primary mb-3">Modo de assinatura PJeOffice</p>
                <Button variant="outline" className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground border-0 gap-3 uppercase text-sm tracking-wide">
                  <IdCard className="size-5" /> Certificado digital
                </Button>
                <a href="#" className="block mt-3 text-sm text-primary hover:underline">
                  Saiba como obter o certificado digital
                </a>
              </div>

              <div className="hidden md:flex flex-col items-center gap-2 text-muted-foreground">
                <span className="w-px flex-1 bg-border h-16" />
                <span className="text-sm">ou</span>
                <span className="w-px flex-1 bg-border h-16" />
              </div>

              <LoginForm />
            </div>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Versão 2.1.2.5 — Ambiente de homologação
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}


function LoginForm() {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(loginSchema),
  });
  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(data.username),
      password: data.password,
    });
    if (error) {
      return toast.error("Falha no acesso", {
        description: "Número de usuário ou senha inválidos.",
      });
    }
    toast.success("Acesso autorizado");
    navigate({ to: "/painel" });
  };
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <Label htmlFor="username" className="sr-only">Número de usuário</Label>
        <Input id="username" autoComplete="username" inputMode="numeric" placeholder="Número de usuário"
          className="h-12 bg-accent/40 border-border" {...register("username")} />
        {errors.username && <p className="text-xs text-destructive mt-1">{errors.username.message}</p>}
      </div>
      <div>
        <Label htmlFor="password" className="sr-only">Senha</Label>
        <Input id="password" type="password" autoComplete="current-password" placeholder="Senha"
          className="h-12 bg-accent/40 border-border" {...register("password")} />
        {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <a href="#" className="text-sm text-primary hover:underline">Gerar nova senha</a>
        <Button type="submit" disabled={isSubmitting} className="h-11 px-8 uppercase text-sm tracking-wide">
          {isSubmitting ? "Autenticando…" : "Entrar"}
        </Button>
      </div>
    </form>
  );
}

