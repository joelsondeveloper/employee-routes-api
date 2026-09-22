import {AlertTriangle, CarFront} from "lucide-react";
import type {RouteGroup} from "../types/api";
import {formatDistance, formatDuration} from "../lib/formatters";
import {friendlyViolation} from "../lib/messages";
import {StatusBadge} from "./StatusBadge";

interface RouteCardProps {
  group: RouteGroup;
  selected: boolean;
  onSelect: () => void;
}

export function RouteCard({group, selected, onSelect}: RouteCardProps) {
  return <article className={`group-card ${selected ? "selected" : ""} ${group.status === "REJECTED" ? "rejected" : ""}`}>
    <button className="group-card-header group-select" onClick={onSelect} aria-pressed={selected} aria-controls="route-map" aria-label={`Selecionar carro ${group.groupNumber}`}>
      <span className="group-title-wrap"><span className="car-icon"><CarFront size={18} /></span>
        <span><span className="group-title">Carro {group.groupNumber}</span>
          <span className="group-subtitle">{group.employees.length} {group.employees.length === 1 ? "passageiro" : "passageiros"}</span></span>
      </span>
      <StatusBadge status={group.status} />
    </button>
    <ol className="route-order" aria-label={`Ordem das paradas do carro ${group.groupNumber}`}>
      {group.stops.map((stop, index) => <li className="stop-row" key={`${stop.id}-${index}`}>
        <span className={`stop-dot ${stop.type === "ORIGIN" ? "origin" : ""}`} aria-hidden="true">{stop.type === "ORIGIN" ? "" : index}</span>
        <span className="stop-name">{stop.type === "ORIGIN" ? "Empresa" : stop.name}</span>
      </li>)}
    </ol>
    <dl className="metrics-row">
      <div><dt className="metric-label">Duração</dt><dd className="metric-value">{formatDuration(group.totalDurationSeconds)}</dd></div>
      <div><dt className="metric-label">Distância</dt><dd className="metric-value">{formatDistance(group.totalDistanceMeters)}</dd></div>
      <div><dt className="metric-label">Desvio médio</dt><dd className="metric-value">{formatDuration(group.averageExtraDurationSeconds)}</dd></div>
      <div><dt className="metric-label">Maior desvio</dt><dd className="metric-value">{formatDuration(group.maxExtraDurationSeconds)}</dd></div>
    </dl>
    {group.violations.length > 0 && <div className="violations">
      <div className="violations-title"><AlertTriangle size={14} />Motivo da atenção</div>
      {group.violations.map((violation) => <p className="violation-item" key={`${violation.employeeId}-${violation.type}`}>
        <strong>{friendlyViolation(violation.type, violation.name, violation.actualValue, violation.limit)}</strong>
      </p>)}
    </div>}
    {group.passengerMetrics.length > 0 && <details className="passenger-details">
      <summary>Tempos por passageiro</summary>
      <ul>{group.passengerMetrics.map((metric) => <li key={metric.employeeId}>
        <strong>{metric.name}</strong>
        <span>Direto: {formatDuration(metric.directDurationSeconds)} · Compartilhado: {formatDuration(metric.sharedDurationSeconds)} · Desvio: {formatDuration(metric.extraDurationSeconds)}</span>
      </li>)}</ul>
    </details>}
  </article>;
}

