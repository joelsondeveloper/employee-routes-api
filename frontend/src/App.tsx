import {useEffect, useState} from "react";
import {Layout} from "./components/Layout";
import {RoutesPage} from "./pages/RoutesPage";
import {EmployeesPage} from "./pages/EmployeesPage";
import {api} from "./services/api";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import {AuthProvider, useAuth} from "./auth/AuthContext";
import {GoogleLoginButton} from "./auth/GoogleLoginButton";

function AuthenticatedApp() {
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
  if (status === "unauthenticated" || status === "error") return <div className="auth-screen"><div className="auth-card"><div className="brand-name">Employee Routes</div><p>Organize o transporte dos seus funcionários.</p><GoogleLoginButton /></div></div>;
  return <Layout page={page} onNavigate={setPage} apiStatus={apiStatus} session={session} onLogout={() => void signOut()}>
    <div hidden={page !== "routes"}><RoutesPage employeeCount={employeeCount} /></div>
    {page === "employees" && <EmployeesPage onCountChange={setEmployeeCount} />}
  </Layout>;
}

export default function App() { return <AuthProvider><AuthenticatedApp /></AuthProvider>; }
