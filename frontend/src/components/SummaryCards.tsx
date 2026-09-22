import {AlertTriangle, CarFront, CheckCircle2, CircleAlert, Users} from "lucide-react";
import type {OptimizationSummary} from "../types/api";

export function SummaryCards({summary, issueCount}: {summary: OptimizationSummary; issueCount: number}) {
  const cards = [
    {label: "Funcionários", value: summary.totalEmployees, caption: "no planejamento", icon: Users, className: ""},
    {label: "Carros", value: summary.totalGroups, caption: "grupos formados", icon: CarFront, className: ""},
    {label: "Rotas válidas", value: summary.acceptableGroups, caption: "prontas para operar", icon: CheckCircle2, className: "success"},
    {label: "Requer atenção", value: summary.rejectedGroups, caption: "rotas fora da restrição", icon: AlertTriangle, className: "warning"},
    {label: "Problemas", value: issueCount, caption: "dados ou roteamento", icon: CircleAlert, className: "issue"},
  ];
  return <div className="summary-grid">{cards.map(({label, value, caption, icon: Icon, className}) => <div className={`summary-card ${className}`} key={label}><div className="summary-card-label"><Icon size={14} />{label}</div><div className="summary-card-value">{value}</div><div className="summary-card-caption">{caption}</div></div>)}</div>;
}
