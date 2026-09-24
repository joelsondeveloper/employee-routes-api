import {useEffect, useState} from "react";
import {Layout} from "./components/Layout";
import {RoutesPage} from "./pages/RoutesPage";
import {EmployeesPage} from "./pages/EmployeesPage";
import {api} from "./services/api";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import {AuthProvider, useAuth} from "./auth/AuthContext";
import {GoogleLoginButton} from "./auth/GoogleLoginButton";
import {GuestProvider, useGuest} from "./guest/GuestContext";

function AuthenticatedApp({onEnterGuest, guestLoading, guestError}: {onEnterGuest: () => void; guestLoading: boolean; guestError?: string}) {
  const {status, session, signOut} = useAuth();
  const [page, setPage] = useState<"routes" | "employees">("routes");
  const [employeeCount, setEmployeeCount] = useState<number>();
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => {
    if (status !== "authenticated") return;
    void api.health().then(() => setApiStatus("online")).catch(() => setApiStatus("offline"));
    void api.listEmployees().then((employees) => setEmployeeCount(employees.length)).catch(() => undefined);
  }, [status]);
  if (status === "loading") return <div className="auth-screen"><p>Verificando sua sessão...</p></div>;
  if (status === "unauthenticated" || status === "error") return <div className="auth-screen"><div className="auth-card"><div className="brand-name">Employee Routes</div><p>Organize o transporte dos seus funcionários.</p><GoogleLoginButton /><div className="auth-divider"><span>ou</span></div><button className="button button-secondary guest-entry-button" onClick={onEnterGuest} disabled={guestLoading}>{guestLoading ? "Abrindo modo visitante..." : "Entrar como visitante"}</button>{guestError && <p className="form-error" role="alert">{guestError}</p>}<p className="auth-note">Explore com dados fictícios salvos somente neste navegador.</p></div></div>;
  return <Layout page={page} onNavigate={setPage} apiStatus={apiStatus} session={session} onLogout={() => void signOut()}>
    <div hidden={page !== "routes"}><RoutesPage employeeCount={employeeCount} /></div>
    {page === "employees" && <EmployeesPage onCountChange={setEmployeeCount} />}
  </Layout>;
}

function GuestApp({onExit}: {onExit: () => void}) {
  const {employees, setEmployees, restore} = useGuest();
  const [page, setPage] = useState<"routes" | "employees">("routes");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => { void api.health().then(() => setApiStatus("online")).catch(() => setApiStatus("offline")); }, []);
  return <Layout page={page} onNavigate={setPage} apiStatus={apiStatus} mode="guest" onExitGuest={onExit}>
    <div hidden={page !== "routes"}><RoutesPage mode="guest" employees={employees} onEmployeesChange={setEmployees} /></div>
    {page === "employees" && <EmployeesPage mode="guest" employees={employees} onGuestEmployeesChange={setEmployees} onRestoreGuest={restore} />}
  </Layout>;
}

function AppContent() {
  const {status} = useAuth();
  const guest = useGuest();
  if (guest.active) return <GuestApp onExit={guest.exit} />;
  if (status === "loading") return <div className="auth-screen"><p>Verificando sua sessão...</p></div>;
  return <AuthenticatedApp onEnterGuest={() => void guest.enter()} guestLoading={guest.loading} guestError={guest.error} />;
}

export default function App() { return <AuthProvider><GuestProvider><AppContent /></GuestProvider></AuthProvider>; }
