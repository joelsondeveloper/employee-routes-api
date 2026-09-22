import {AlertTriangle, CheckCircle2} from "lucide-react";
import type {RouteStatus} from "../types/api";

export function StatusBadge({status}: {status: RouteStatus}) {
  const accepted = status === "ACCEPTED";
  return <span className={`status ${accepted ? "accepted" : "rejected"}`}>{accepted ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}{accepted ? "Rota válida" : "Requer atenção"}</span>;
}
