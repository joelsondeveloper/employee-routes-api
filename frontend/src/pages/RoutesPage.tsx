import {AlertCircle, Download, Edit3, MapPinned, RefreshCw, Route as RouteIcon} from "lucide-react";
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
import {ManualRouteEditor} from "../components/ManualRouteEditor";
import {buildUberPreview, internalJson, operationalCsv, routeText} from "../lib/route-export";
import {formatElapsed} from "../lib/formatters";

function EmptyRoutes({onOptimize, employeeCount}: {onOptimize: () => void; employeeCount?: number}) {
  return <div className="empty-state"><div className="empty-inner">
    <div className="empty-icon"><RouteIcon size={28} /></div>
    <h2 className="empty-title">Nenhuma rota gerada</h2>
    <p className="empty-copy">Gere as rotas para organizar os funcionários cadastrados em grupos de transporte.</p>
    {employeeCount !== undefined && <p className="section-note empty-count">{employeeCount} {employeeCount === 1 ? "funcionário cadastrado" : "funcionários cadastrados"}</p>}
    <button className="button button-primary" onClick={onOptimize}><RouteIcon size={16} />Gerar rotas</button>
  </div></div>;
}

function LoadingRoutes({employeeCount}: {employeeCount: number}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activities = ["Preparando funcionários", "Calculando trajetos", "Avaliando combinações", "Finalizando rotas"];
  const activityIndex = Math.min(activities.length - 1, Math.floor(elapsedSeconds / 8));

  return <div className="loading-panel" aria-busy="true"><div className="empty-inner">
    <div className="spinner" aria-hidden="true" />
    <h2 className="loading-title">Otimizando rotas...</h2>
    <p className="loading-copy">Estamos analisando {employeeCount} {employeeCount === 1 ? "funcionário" : "funcionários"} e seus trajetos. Isso pode levar cerca de 1–2 minutos.</p>
    <div className="loading-activity" role="status" aria-live="polite">
      <span className="loading-activity-dot" aria-hidden="true" />
      <span>{activities[activityIndex]}</span>
    </div>
    <p className="loading-elapsed">Tempo decorrido: <strong>{formatElapsed(elapsedSeconds)}</strong></p>
    <p className="loading-honesty">As mensagens indicam a atividade da operação; o resultado aparece quando o backend concluir o cálculo.</p>
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

function Results({result, manuallyModified, onEdit, onExport}: {result: OptimizationResponse; manuallyModified: boolean; onEdit: () => void; onExport: (kind: "uber" | "json" | "csv" | "text") => void}) {
  const [selectedNumber, setSelectedNumber] = useState<number | undefined>(result.groups[0]?.groupNumber);
  const selectedGroup = result.groups.find((group) => group.groupNumber === selectedNumber);
  const routedCount = result.groups.reduce((total, group) => total + group.employees.length, 0);
  const issueEmployees = result.summary.totalEmployees - routedCount;
  const anomalous = result.groups.filter(isAnomalousGroup);
  return <>
    {manuallyModified && <p className="section-note result-context">Modificada manualmente · métricas recalculadas</p>}
    <SummaryCards summary={result.summary} issueCount={result.issues.length} />
    <p className="section-note result-context">Resultado desta sessão. Os dados podem ser revistos em Funcionários; gere novamente após alterações.</p>
    <div className="results-layout">
      <section className="groups-column" aria-labelledby="groups-title">
        <div className="section-heading"><div><h2 className="section-title" id="groups-title">Grupos de transporte</h2>
          <div className="section-note">Selecione um carro para destacar sua sequência no mapa.</div></div>
          <div className="editor-actions"><button className="button button-secondary" onClick={onEdit}><Edit3 size={15}/>Editar rotas</button><label className="button button-quiet export-select"><Download size={15}/>Exportar<select aria-label="Exportar rotas" defaultValue="" onChange={event => {if (event.target.value) onExport(event.target.value as "uber" | "json" | "csv" | "text"); event.currentTarget.value = "";}}><option value="">Escolher</option><option value="uber">Uber</option><option value="json">JSON</option><option value="csv">CSV</option><option value="text">Texto</option></select></label></div>
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
  const {state, optimize, applyResult} = useOptimization();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectionOpen, setSelectionOpen] = useState(false);
  const [employeeLoadError, setEmployeeLoadError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [originalResult, setOriginalResult] = useState<OptimizationResponse>();
  const [exportPreview, setExportPreview] = useState<string>();
  const [manuallyModified, setManuallyModified] = useState(false);
  const lastSelection = useRef<string[]>([]);
  const loading = state.status === "loading";
  useEffect(() => {
    void api.listEmployees().then(setEmployees).catch(() => setEmployeeLoadError("Não foi possível carregar os funcionários para a seleção."));
  }, []);
  const openSelection = () => { if (!loading) setSelectionOpen(true); };
  const confirmSelection = (ids: string[]) => { lastSelection.current = ids; setManuallyModified(false); setSelectionOpen(false); void optimize(ids).then(result => {if (result) setOriginalResult(result);}); };
  const saveEdits = async (groups: import("../types/api").ManualRouteInput[]) => { setEditLoading(true); try { const result = await api.recalculateRoutes(lastSelection.current, groups); applyResult(result); setManuallyModified(true); setEditing(false); } finally { setEditLoading(false); } };
  const exportResult = (kind: "uber" | "json" | "csv" | "text") => { if (!state.result) return; if (kind === "uber") { const previews = buildUberPreview(state.result, employees); setExportPreview(JSON.stringify(previews, null, 2)); } else { const content = kind === "json" ? internalJson(state.result, employees) : kind === "csv" ? operationalCsv(state.result, employees) : routeText(state.result); const blob = new Blob([content], {type: kind === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8"}); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `rotas.${kind === "json" ? "json" : kind === "csv" ? "csv" : "txt"}`; anchor.click(); URL.revokeObjectURL(url); } };
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
    {loading && <LoadingRoutes employeeCount={state.status === "loading" ? state.employeeCount : lastSelection.current.length} />}
    {state.status === "error" && <ErrorRoutes message={friendlyApiError(state.error instanceof ApiError ? state.error.code : undefined)}
      onRetry={() => void optimize(lastSelection.current)} />}
    {state.result && <>
      {(loading || state.status === "error") && <p className="section-note result-context">O resultado anterior continua disponível abaixo.</p>}
      {editing ? <ManualRouteEditor result={state.result} employees={employees} loading={editLoading} onCancel={() => setEditing(false)} onRestore={() => {if (originalResult) {applyResult(originalResult); setManuallyModified(false); setEditing(false);}}} onSave={saveEdits} /> : <Results key={state.status === "success" ? "current" : "previous"} result={state.result} manuallyModified={manuallyModified} onEdit={() => setEditing(true)} onExport={exportResult} />}
    </>}
    {selectionOpen && <EmployeeSelectionModal employees={employees} onClose={() => setSelectionOpen(false)} onConfirm={confirmSelection} />}
    {exportPreview && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal-card"><div className="modal-header"><h2>Prévia Uber</h2><button className="icon-button" aria-label="Fechar prévia" onClick={() => setExportPreview(undefined)}>×</button></div><p className="section-note">Esta prévia não cria corridas nem envia dados à Uber.</p><pre className="export-preview">{exportPreview}</pre><div className="modal-actions"><button className="button button-primary" onClick={() => void navigator.clipboard?.writeText(exportPreview)}>Copiar JSON</button><button className="button button-quiet" onClick={() => setExportPreview(undefined)}>Fechar</button></div></div></div>}
  </>;
}
