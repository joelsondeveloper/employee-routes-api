import {Edit3, LoaderCircle, MapPin, MapPinned, Plus, Search, Trash2, UserRound, X} from "lucide-react";
import {useEffect, useState, useRef, type FormEvent} from "react";
import {api, ApiError} from "../services/api";
import type {Employee} from "../types/api";
import {friendlyApiError} from "../lib/messages";
import {formatPhone} from "../lib/formatters";
import {Modal} from "../components/Modal";
import {EmployeeLocationMap, type EmployeeCoordinates} from "../components/EmployeeLocationMap";

type FormValues = Pick<Employee, "name" | "address" | "phone">;
const emptyForm: FormValues = {name: "", address: "", phone: ""};
const errorMessage = (error: unknown, fallback: string) =>
  friendlyApiError(error instanceof ApiError ? error.code : undefined, fallback);

function EmployeeModal({employee, onClose, onSaved}: {
  employee?: Employee; onClose: () => void; onSaved: (employee: Employee) => void;
}) {
  const [values, setValues] = useState<FormValues>(employee
    ? {name: employee.name, address: employee.address, phone: employee.phone} : emptyForm);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coordinates, setCoordinates] = useState<EmployeeCoordinates | null>(employee
    ? {latitude: employee.latitude, longitude: employee.longitude} : null);
  const [locationState, setLocationState] = useState<"existing" | "found" | "adjusted" | undefined>(employee ? "existing" : undefined);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const update = (field: keyof FormValues, value: string) => setValues((current) => ({...current, [field]: value}));
  const locate = async () => {
    const address = values.address.trim();
    if (!address) { setError("Preencha o endereço antes de localizar."); return; }
    setLocating(true); setError("");
    try {
      const found = await api.geocodePreview(address);
      setCoordinates(found);
      setLocationState("found");
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível localizar esse endereço."));
    } finally { setLocating(false); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    const input = {name: values.name.trim(), address: values.address.trim(), phone: values.phone.trim()};
    if (!input.name || !input.address || !input.phone) { setError("Preencha nome, telefone e endereço."); return; }
    pending.current = true;
    setSaving(true); setError("");
    try {
      const payload = coordinates ? {...input, latitude: coordinates.latitude, longitude: coordinates.longitude} : input;
      const saved = employee ? await api.updateEmployee(employee.id, payload) : await api.createEmployee(payload);
      onSaved(saved); onClose();
    } catch (caught) {
      setError(errorMessage(caught, "Não foi possível salvar o funcionário."));
    } finally { pending.current = false; setSaving(false); }
  };
  return <Modal titleId="employee-modal-title" onClose={onClose} busy={saving || locating}>
    <form onSubmit={(event) => void submit(event)}>
      <div className="modal-header">
        <div>
          <h2 id="employee-modal-title" className="modal-title">{employee ? "Editar funcionário" : "Novo funcionário"}</h2>
          <p className="modal-copy">Confirme no mapa o ponto usado pelas rotas.</p>
        </div>
        <button type="button" className="button-icon" onClick={onClose} disabled={saving} aria-label="Fechar"><X size={18} /></button>
      </div>
      <div className="modal-body">
        {error && <div className="form-error" role="alert">{error}</div>}
        <label className="form-field"><span className="form-label">Nome</span>
          <input className="form-input" required data-initial-focus autoComplete="name" value={values.name} disabled={saving} onChange={(event) => update("name", event.target.value)} />
        </label>
        <label className="form-field"><span className="form-label">Telefone</span>
          <input className="form-input" required type="tel" autoComplete="tel" value={values.phone} disabled={saving} onChange={(event) => update("phone", event.target.value)} />
        </label>
        <label className="form-field"><span className="form-label">Endereço</span>
          <input className="form-input" required autoComplete="street-address" value={values.address} disabled={saving || locating} onChange={(event) => update("address", event.target.value)} />
        </label>
        <section className="location-section" aria-labelledby="location-title">
          <div className="location-section-heading"><div><h3 id="location-title" className="form-label"><MapPinned size={14} /> Localização</h3>
            <p className="modal-copy">O endereço descreve o local; as coordenadas abaixo são usadas no roteamento.</p></div>
            <button type="button" className="button button-secondary" onClick={() => void locate()} disabled={saving || locating}><Search size={14} />{locating ? "Localizando..." : "Localizar no mapa"}</button></div>
          {locating && <div className="section-note" role="status"><LoaderCircle size={14} className="spin-inline" /> Localizando endereço...</div>}
          {coordinates ? <><EmployeeLocationMap coordinates={coordinates} onChange={(next) => { setCoordinates(next); setLocationState("adjusted"); }} />
            <p className="location-help" role="status">{locationState === "adjusted" ? "Localização ajustada manualmente." : locationState === "found" ? "Localização encontrada. Arraste o marcador se necessário." : "Localização cadastrada. Arraste o marcador para corrigir."}</p>
            <p className="location-coordinates">{coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}</p></> : <p className="location-empty">Localize o endereço para confirmar o ponto no mapa. Se não localizar agora, o backend ainda poderá geocodificar ao salvar.</p>}
        </section>
        {saving && <div className="section-note" role="status"><LoaderCircle size={14} className="spin-inline" /> Salvando funcionário...</div>}
      </div>
      <div className="modal-footer">
        <button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className="button button-primary" disabled={saving}>{saving ? "Salvando..." : employee ? "Salvar alterações" : "Cadastrar"}</button>
      </div>
    </form>
  </Modal>;
}

function DeleteModal({employee, onClose, onConfirm, deleting, error}: {
  employee: Employee; onClose: () => void; onConfirm: () => void; deleting: boolean; error: string;
}) {
  return <Modal titleId="delete-title" role="alertdialog" onClose={onClose} busy={deleting}>
    <div className="modal-header">
      <div><h2 id="delete-title" className="modal-title">Excluir {employee.name}?</h2>
        <p className="modal-copy">Esta ação removerá o funcionário do sistema.</p></div>
      <button className="button-icon" onClick={onClose} disabled={deleting} aria-label="Fechar"><X size={18} /></button>
    </div>
    {error && <div className="modal-body"><div className="form-error" role="alert">{error}</div></div>}
    <div className="modal-footer">
      <button className="button button-secondary" onClick={onClose} disabled={deleting} data-initial-focus>Cancelar</button>
      <button className="button button-danger" onClick={onConfirm} disabled={deleting}>{deleting ? "Excluindo..." : "Excluir"}</button>
    </div>
  </Modal>;
}

export function EmployeesPage({onCountChange}: {onCountChange?: (count: number) => void}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<"create" | Employee>();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirming, setConfirming] = useState<Employee>();

  const load = async () => {
    setLoading(true); setError("");
    try { setEmployees(await api.listEmployees()); }
    catch (caught) { setError(errorMessage(caught, "Não foi possível carregar os funcionários.")); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (!loading && !error) onCountChange?.(employees.length); }, [employees, loading, error, onCountChange]);

  const remove = async (employee: Employee) => {
    if (deleting) return;
    setDeleting(true); setDeleteError("");
    try {
      await api.deleteEmployee(employee.id);
      setEmployees((current) => current.filter((item) => item.id !== employee.id));
      setConfirming(undefined);
    } catch (caught) { setDeleteError(errorMessage(caught, "Não foi possível excluir o funcionário.")); }
    finally { setDeleting(false); }
  };

  return <>
    <div className="page-heading">
      <div><p className="eyebrow">Base operacional</p><h1 className="page-title">Funcionários</h1>
        <p className="page-description">Consulte e mantenha os funcionários que entram no planejamento de transporte.</p>
        {!loading && !error && <p className="section-note">{employees.length} funcionários cadastrados</p>}
      </div>
      <button className="button button-primary" onClick={() => setModal("create")}><Plus size={16} />Novo funcionário</button>
    </div>
    {error && <div className="form-error" role="alert">{error}
      <button className="button button-quiet" onClick={() => void load()}>Tentar novamente</button>
    </div>}
    <div className="table-shell">
      {loading ? <div className="empty-table" role="status"><LoaderCircle className="spin-inline" size={20} /> Carregando funcionários...</div>
        : !error && employees.length === 0 ? <div className="empty-table"><UserRound size={22} /><p>Nenhum funcionário cadastrado.</p></div>
        : !error && <table className="employee-table">
          <caption className="sr-only">Funcionários cadastrados</caption>
          <thead><tr><th scope="col">Funcionário</th><th scope="col">Endereço</th><th scope="col">Telefone</th><th scope="col">Localização</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead>
          <tbody>{employees.map((employee) => {
            const located = Number.isFinite(employee.latitude) && Number.isFinite(employee.longitude)
              && Math.abs(employee.latitude) <= 90 && Math.abs(employee.longitude) <= 180;
            return <tr key={employee.id}>
              <td data-label="Funcionário"><div className="employee-name">{employee.name}</div></td>
              <td data-label="Endereço"><div className="employee-address">{employee.address}</div></td>
              <td data-label="Telefone" className="muted">{formatPhone(employee.phone)}</td>
              <td data-label="Localização"><span className={`status ${located ? "accepted" : "issue"}`}><MapPin size={12} />{located ? "Coordenadas cadastradas" : "Verificar localização"}</span></td>
              <td data-label="Ações"><div className="table-actions">
                <button className="button-icon" aria-label={`Editar ${employee.name}`} onClick={() => setModal(employee)}><Edit3 size={15} /></button>
                <button className="button-icon" aria-label={`Excluir ${employee.name}`} onClick={() => { setConfirming(employee); setDeleteError(""); }}><Trash2 size={15} /></button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>}
    </div>
    {modal && <EmployeeModal employee={modal === "create" ? undefined : modal} onClose={() => setModal(undefined)}
      onSaved={(saved) => setEmployees((current) => modal === "create" ? [saved, ...current] : current.map((item) => item.id === saved.id ? saved : item))} />}
    {confirming && <DeleteModal employee={confirming} onClose={() => setConfirming(undefined)}
      onConfirm={() => void remove(confirming)} deleting={deleting} error={deleteError} />}
  </>;
}
