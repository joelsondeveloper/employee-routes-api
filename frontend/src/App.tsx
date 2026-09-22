import {useEffect, useState} from "react";
import {Layout} from "./components/Layout";
import {RoutesPage} from "./pages/RoutesPage";
import {EmployeesPage} from "./pages/EmployeesPage";
import {api} from "./services/api";
import "leaflet/dist/leaflet.css";
import "./styles.css";

export default function App() {
  const [page, setPage] = useState<"routes" | "employees">("routes");
  const [employeeCount, setEmployeeCount] = useState<number>();
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => {
    void api.health().then(() => setApiStatus("online")).catch(() => setApiStatus("offline"));
    void api.listEmployees().then((employees) => setEmployeeCount(employees.length)).catch(() => undefined);
  }, []);
  return <Layout page={page} onNavigate={setPage} apiStatus={apiStatus}>
    <div hidden={page !== "routes"}><RoutesPage employeeCount={employeeCount} /></div>
    {page === "employees" && <EmployeesPage onCountChange={setEmployeeCount} />}
  </Layout>;
}
