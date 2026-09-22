import {AlertCircle, MapPinned, RefreshCw, Route as RouteIcon} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {useOptimization} from "../hooks/useOptimization";
import {api, ApiError} from "../services/api";
import {friendlyApiError} from "../lib/messages";
import {isAnomalousGroup} from "../lib/route-utils";
import type {OptimizationResponse} from "../types/api";
import {RouteCard} from "../components/RouteCard";
import {RouteMap} from "../components/RouteMap";
import {SummaryCards} from "../components/SummaryCards";
import {EmployeeSelectionModal} from "../components/EmployeeSelectionModal";
import type {Employee} from "../types/api";

function EmptyRoutes({onOptimize, employeeCount}: {onOptimize: () => void; employeeCount?: number}) {
  return <div className="empty-state"><div className="empty-inner">
    <div className="empty-icon"><RouteIcon size={28} /></div>
    <h2 className="empty-title">Nenhuma rota gerada</h2>
    <p className="empty-copy">Gere as rotas para organizar os funcionários cadastrados em grupos de transporte.</p>
    {employeeCount !== undefined && <p className="section-note empty-count">{employeeCount} {employeeCount === 1 ? "funcionário cadastrado" : "funcionários cadastrados"}</p>}
    <button className="button button-primary" onClick={onOptimize}><RouteIcon size={16} />Gerar rotas</button>
  </div></div>;
}

function LoadingRoutes() {
  return <div className="loading-panel" role="status"><div className="empty-inner">
    <div className="spinner" aria-hidden="true" /><h2 className="loading-title">Calculando melhores rotas...</h2>
    <p className="loading-copy">Estamos analisando proximidade, tempo de viagem e possíveis combinações entre os funcionários. Isso pode levar cerca de 1–2 minutos.</p>
  </div></div>;
}

function ErrorRoutes({message, onRetry}: {message: string; onRetry: () => void}) {
  return <div className="error-panel" role="alert"><div className="empty-inner">
    <div className="error-icon"><AlertCircle size={25} /></div>
    <h2 className="error-title">Não foi possível gerar as rotas</h2><p className="error-copy">{message}</p>
    <button className="button button-secondary" onClick={onRetry}><RefreshCw size={15} />Tentar novamente</button>
  </div></div>;
}

function IssuesPanel({result}: {result: OptimizationResponse}) {
  if (!result.issues.length) return null;
  return <section className="issue-panel" aria-labelledby="issues-title">
    <h2 className="issue-heading" id="issues-title"><AlertCircle size={17} />Problemas encontrados</h2>
    <div className="issue-list">{result.issues.map((issue, index) => <div className="issue-item" key={`${issue.type}-${issue.employeeId || issue.groupNumber}-${index}`}>
      <AlertCircle size={17} aria-hidden="true" />
      <div><strong>{issue.employee?.name || (issue.employeeId ? `Funcionário ${issue.employeeId}` : `Grupo ${issue.groupNumber}`)}</strong>
        {issue.type === "UNROUTABLE_EMPLOYEE"
          ? <span>Não foi possível calcular uma rota para este funcionário. Verifique os dados de localização cadastrados.</span>
          : <><span>Não foi possível encontrar uma rota completa para este grupo.</span>
            <span>Funcionários: {issue.employees?.map((employee) => employee.name).join(", ")}</span></>}
      </div>
    </div>)}</div>
  </section>;
}

function Results({result}: {result: OptimizationResponse}) {
  const [selectedNumber, setSelectedNumber] = useState<number | undefined>(result.groups[0]?.groupNumber);
  const selectedGroup = result.groups.find((group) => group.groupNumber === selectedNumber);
  const routedCount = result.groups.reduce((total, group) => total + group.employees.length, 0);
  const issueEmployees = result.summary.totalEmployees - routedCount;
  const anomalous = result.groups.filter(isAnomalousGroup);
  return <>
    <SummaryCards summary={result.summary} issueCount={result.issues.length} />
    <p className="section-note result-context">Resultado desta sessão. Os dados podem ser revistos em Funcionários; gere novamente após alterações.</p>
    <div className="results-layout">
      <section className="groups-column" aria-labelledby="groups-title">
        <div className="section-heading"><div><h2 className="section-title" id="groups-title">Grupos de transporte</h2>
          <div className="section-note">Selecione um carro para destacar sua sequência no mapa.</div></div>
        </div>
        {result.groups.length === 0 && <p className="empty-table">Nenhum grupo calculável neste resultado.</p>}
        {result.groups.map((group) => <RouteCard key={group.groupNumber} group={group}
          selected={group.groupNumber === selectedNumber} onSelect={() => setSelectedNumber(group.groupNumber)} />)}
      </section>
      {result.groups.length > 0 && <aside className="map-panel" id="route-map" aria-label="Mapa de paradas">
        <div className="map-panel-header"><div><h2 className="map-title">Mapa de paradas</h2>
          <div className="map-caption" aria-live="polite">{selectedGroup ? `Carro ${selectedGroup.groupNumber} em destaque` : "Todas as paradas"}</div>
        </div><MapPinned size={19} /></div>
        <RouteMap groups={result.groups} selectedGroup={selectedGroup} />
        <div className="map-legend"><span className="legend-item"><span className="legend-dot origin" />Empresa</span>
          <span className="legend-item"><span className="legend-dot" />Funcionário</span>
          <button className="button button-quiet" onClick={() => setSelectedNumber(undefined)}>Ver todos</button>
        </div>
        <p className="map-disclaimer">A linha indica a sequência das paradas, não o trajeto pelas ruas.</p>
      </aside>}
    </div>
    <IssuesPanel result={result} />
    {anomalous.length > 0 && <div className="issue-panel diagnostic-panel">
      <h2 className="issue-heading"><AlertCircle size={17} />Distância ou duração incomum</h2>
      <div className="issue-list">{anomalous.map((group) => <div className="issue-item" key={group.groupNumber}>
        <div><strong>Carro {group.groupNumber} · {group.employees.map((employee) => employee.name).join(", ")}</strong>
          <span>Verifique a localização cadastrada. Este aviso não altera o status da rota.</span></div>
      </div>)}</div>
    </div>}
    <p className="section-note result-context">{routedCount} funcionários em {result.groups.length} carros calculáveis; {issueEmployees} {issueEmployees === 1 ? "identificado" : "identificados"} em problemas.</p>
  </>;
}

export function RoutesPage({employeeCount}: {employeeCount?: number}) {
  const {state, optimize} = useOptimization();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [employeeLoadError, setEmployeeLoadError] = useState("");
  const lastSelection = useRef<string[]>([]);
  const loading = state.status === "loading";
  useEffect(() => {
    void api.listEmployees().then(setEmployees).catch(() => setEmployeeLoadError("Não foi possível carregar os funcionários para a seleção."));
  }, []);
  const openSelection = () => { if (!loading) setSelectionOpen(true); };
  const confirmSelection = (ids: string[]) => { lastSelection.current = ids; setSelectionOpen(false); void optimize(ids); };
  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Planejamento operacional</p><h1 className="page-title">Rotas de transporte</h1>
        <p className="page-description">Organize automaticamente o transporte dos funcionários após o expediente.</p></div>
      <button className="button button-primary" onClick={openSelection} disabled={loading || employees.length === 0}><RouteIcon size={16} />
        {loading ? "Calculando..." : state.result ? "Gerar novas rotas" : "Gerar rotas"}
      </button>
    </div>
    {employeeLoadError && state.status === "idle" && <p className="form-error" role="alert">{employeeLoadError}</p>}
    {state.status === "idle" && <EmptyRoutes onOptimize={openSelection} employeeCount={employeeCount} />}
    {loading && <LoadingRoutes />}
    {state.status === "error" && <ErrorRoutes message={friendlyApiError(state.error instanceof ApiError ? state.error.code : undefined)}
      onRetry={() => void optimize(lastSelection.current)} />}
    {state.result && <>
      {(loading || state.status === "error") && <p className="section-note result-context">O resultado anterior continua disponível abaixo.</p>}
      <Results key={state.status === "success" ? "current" : "previous"} result={state.result} />
    </>}
    {selectionOpen && <EmployeeSelectionModal employees={employees} onClose={() => setSelectionOpen(false)} onConfirm={confirmSelection} />}
  </>;
}
