import {useState} from "react";
import type {ReactNode} from "react";
import {Map, Menu, Route, Users, X} from "lucide-react";

interface LayoutProps {
  page: "routes" | "employees";
  onNavigate: (page: "routes" | "employees") => void;
  children: ReactNode;
  apiStatus?: "checking" | "online" | "offline";
}

export function Layout({page, onNavigate, children, apiStatus = "checking"}: LayoutProps) {
  const [open, setOpen] = useState(false);
  const navigate = (next: "routes" | "employees") => { onNavigate(next); setOpen(false); };
  const statusLabel = apiStatus === "online" ? "API operacional conectada" : apiStatus === "offline" ? "API indisponível" : "Verificando API...";
  return (
    <div className="app-shell">
      <aside id="main-navigation" className={`sidebar ${open ? "open" : ""}`} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
        <button className="button-icon nav-close" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
        <div className="brand">
          <div className="brand-mark"><Route size={19} strokeWidth={2.4} /></div>
          <div><div className="brand-name">Employee Routes</div><div className="brand-subtitle">Operação de transporte</div></div>
        </div>
        <nav className="nav" aria-label="Navegação principal">
          <button className={`nav-link ${page === "routes" ? "active" : ""}`} aria-current={page === "routes" ? "page" : undefined} onClick={() => navigate("routes")}><Map size={17} />Rotas</button>
          <button className={`nav-link ${page === "employees" ? "active" : ""}`} aria-current={page === "employees" ? "page" : undefined} onClick={() => navigate("employees")}><Users size={17} />Funcionários</button>
        </nav>
        <div className="sidebar-footer">V1 · Otimização operacional<br />Dados calculados sob demanda</div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="mobile-nav-toggle" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} aria-controls="main-navigation" onClick={() => setOpen((value) => !value)}>{open ? <X size={18} /> : <Menu size={18} />}</button>
          <div className="topbar-context"><span className={`online-dot ${apiStatus}`} />{statusLabel}</div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
