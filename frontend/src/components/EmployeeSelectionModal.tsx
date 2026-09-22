import {Check, Search, Users, X} from "lucide-react";
import {useMemo, useState} from "react";
import {Modal} from "./Modal";
import type {Employee} from "../types/api";

export function EmployeeSelectionModal({employees, onClose, onConfirm}: {
  employees: Employee[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return normalized ? employees.filter((employee) => employee.name.toLocaleLowerCase().includes(normalized)) : employees;
  }, [employees, query]);
  const allSelected = employees.length > 0 && selected.size === employees.length;
  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAll = () => setSelected(allSelected ? new Set() : new Set(employees.map((employee) => employee.id)));
  return <Modal titleId="employee-selection-title" onClose={onClose}>
    <div className="modal-header"><div><h2 id="employee-selection-title" className="modal-title">Selecionar funcionários</h2>
      <p className="modal-copy">Quem precisará de transporte nesta execução?</p></div>
      <button type="button" className="button-icon" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <div className="modal-body selection-body">
      <label className="search-field"><Search size={16} aria-hidden="true" /><span className="sr-only">Buscar funcionário</span>
        <input className="form-input" data-initial-focus placeholder="Buscar funcionário" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="selection-toolbar"><button type="button" className="button button-quiet" onClick={selectAll} disabled={!employees.length}>
        <Check size={14} />{allSelected ? "Limpar seleção" : "Selecionar todos"}</button>
        <span className="selection-count" aria-live="polite">{selected.size} de {employees.length} selecionados</span></div>
      <div className="employee-selection-list" role="group" aria-label="Funcionários disponíveis">
        {filtered.map((employee) => <label className="employee-option" key={employee.id}>
          <input type="checkbox" checked={selected.has(employee.id)} onChange={() => toggle(employee.id)} />
          <span><strong>{employee.name}</strong><small>{employee.address}</small></span>
        </label>)}
        {!filtered.length && <p className="empty-table">Nenhum funcionário encontrado.</p>}
      </div>
    </div>
    <div className="modal-footer"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button>
      <button type="button" className="button button-primary" disabled={selected.size === 0} onClick={() => onConfirm([...selected])}><Users size={15} />Gerar rotas para {selected.size}</button></div>
  </Modal>;
}
