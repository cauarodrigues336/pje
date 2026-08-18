import { Link } from "@tanstack/react-router";
import { Scale, LogOut, User as UserIcon, Menu, FilePlus2, Search, FileSearch, Newspaper, LayoutDashboard, Inbox, FileStack, UserPlus, CalendarClock, Users, Bell, UserCheck, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, isJulgadorRole, isAdvocaciaRole } from "@/lib/pje";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function GovBar() {
  return (
    <div className="bg-header text-header-foreground text-xs">
      <div className="mx-auto max-w-7xl px-4 py-1.5 flex items-center justify-between">
        <a href="https://www.gov.br" className="flex items-center gap-1.5 font-semibold tracking-wide hover:underline">
          <span className="inline-block size-2 rounded-full bg-gov-yellow" />
          <span className="inline-block size-2 rounded-full bg-gov-green" />
          <span className="ml-1">PODER JUDICIÁRIO</span>
        </a>
        <div className="hidden sm:flex items-center gap-4 opacity-90">
          <a href="#" className="hover:underline">Acessibilidade</a>
          <a href="#" className="hover:underline">Mapa do site</a>
          <a href="#" className="hover:underline">Alto contraste</a>
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const { user, role, nome } = useAuth();

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const isMag = isJulgadorRole(role);
  const isServ = role === "servidor";
  const isAdv = isAdvocaciaRole(role) || role === "cidadao";
  const isAdmin = role === "admin";

  // Painel principal — itens visíveis conforme perfil
  const navItems = !user
    ? [
        { to: "/", label: "Início", icon: Scale },
        { to: "/consulta", label: "Consulta Pública", icon: Search },
      ]
    : isMag
    ? [
        { to: "/painel", label: "Painel", icon: LayoutDashboard },
        { to: "/meus-processos", label: "Meus processos", icon: Inbox },
        { to: "/consultas/$sistema", label: "Sistemas CNJ (SISBAJUD, RENAJUD…)", icon: FileSearch, params: { sistema: "sisbajud" } },
      ]
    : isServ
    ? [
        { to: "/painel", label: "Painel", icon: LayoutDashboard },
        { to: "/meus-processos", label: "Meus processos", icon: Inbox },
        { to: "/consultas/$sistema", label: "Sistemas CNJ (SISBAJUD, RENAJUD…)", icon: FileSearch, params: { sistema: "sisbajud" } },
        { to: "/habilitacoes-pendentes", label: "Habilitações pendentes", icon: UserCheck },
        { to: "/processos", label: "Consultar processos", icon: Search },
      ]
    : isAdv
    ? [
        { to: "/painel", label: "Painel", icon: LayoutDashboard },
        { to: "/novo-processo", label: "Novo Processo", icon: FilePlus2 },
        { to: "/nao-protocolados", label: "Não Protocolados", icon: FileStack },
        { to: "/habilitacao", label: "Habilitação", icon: UserPlus },
        { to: "/pauta-audiencias", label: "Pauta de Audiências", icon: CalendarClock },
        { to: "/intimacoes", label: "Minhas intimações", icon: Bell },
        { to: "/prazos", label: "Prazos", icon: Clock },
        { to: "/meus-processos", label: "Meus processos", icon: Inbox },
      ]
    : isAdmin
    ? [
        { to: "/painel", label: "Painel", icon: LayoutDashboard },
        { to: "/admin/usuarios", label: "Cadastrar usuários", icon: Users },
        { to: "/novo-processo", label: "Novo Processo", icon: FilePlus2 },
        { to: "/processos", label: "Consultar processos", icon: Search },
      ]
    : [
        { to: "/painel", label: "Painel", icon: LayoutDashboard },
      ];

  // Itens do menu hambúrguer (extras acessíveis para todos logados)
  const extras = user && !isMag
    ? [
        { to: "/bnmp", label: "BNMP", icon: FileSearch },
        { to: "/diario", label: "Diário Judicial Eletrônico", icon: Newspaper },
      ]
    : user && isMag
    ? [
        { to: "/diario", label: "Diário Judicial Eletrônico", icon: Newspaper },
      ]
    : [];

  return (
    <header className="bg-header text-header-foreground sticky top-0 z-40 shadow-sm">
      <div className="mx-auto max-w-[1600px] px-3 h-[60px] flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu" className="text-header-foreground hover:bg-white/15 hover:text-header-foreground">
              <Menu className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Navegação</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {navItems.map((n) => (
              <DropdownMenuItem key={n.to} asChild>
                <a href={"params" in n ? `/consultas/${(n as { params: { sistema: string } }).params.sistema}` : n.to} className="flex items-center gap-2 w-full">
                  <n.icon className="size-4" /> {n.label}
                </a>
              </DropdownMenuItem>
            ))}
            {extras.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Mais</DropdownMenuLabel>
                {extras.map((n) => (
                  <DropdownMenuItem key={n.to} asChild>
                    <Link to={n.to} className="flex items-center gap-2 w-full">
                      <n.icon className="size-4" /> {n.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Link to={user ? "/painel" : "/"} className="flex items-center gap-3">
          <PJeMark />
          <span className="text-lg md:text-xl font-normal tracking-tight">
            Processo Judicial Eletrônico
          </span>
        </Link>

        <nav className="ml-auto hidden lg:flex items-center gap-1 text-sm">
          <Link to="/consulta" className="px-3 py-2 rounded hover:bg-white/12">Consulta processual</Link>
          <a href="#" className="px-3 py-2 rounded hover:bg-white/12">Pré-requisitos</a>
          <a href="#" className="px-3 py-2 rounded hover:bg-white/12">Manuais</a>
          <a href="#" className="px-3 py-2 rounded hover:bg-white/12">Fale conosco</a>
        </nav>

        <div className="ml-auto lg:ml-3 flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-header-foreground hover:bg-white/15 hover:text-header-foreground">
                  <UserIcon className="size-4" />
                  <span className="hidden sm:inline max-w-[140px] truncate">{nome ?? user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="font-semibold">{nome ?? "Usuário"}</div>
                  {role && (
                    <div className="text-xs mt-1 inline-block bg-accent text-accent-foreground px-2 py-0.5 rounded">
                      {ROLE_LABELS[role]}
                    </div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="size-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/auth" className="px-3 py-2 rounded text-sm hover:bg-white/12">Entrar</Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function PJeMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline leading-none select-none ${className}`}>
      <span className="font-serif text-2xl md:text-[26px] tracking-tight">PJ</span>
      <span className="font-serif text-2xl md:text-[26px] italic text-gov-yellow">e</span>
    </span>
  );
}


export function SiteFooter() {
  return (
    <footer className="mt-auto bg-header text-header-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 text-sm">
        <div className="max-w-2xl">
          <div className="font-bold mb-2">PJe — Processo Judicial Eletrônico</div>
          <p className="text-header-foreground/80">
            Sistema de tramitação de processos judiciais em meio eletrônico.
            Conforme Lei nº 11.419/2006 e Resolução CNJ nº 185/2013.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-3 text-xs text-header-foreground/70 flex flex-wrap items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} Conselho Nacional de Justiça — Demonstração</div>
          <div>v 2.x · Ambiente de homologação</div>
        </div>
      </div>
    </footer>
  );
}
