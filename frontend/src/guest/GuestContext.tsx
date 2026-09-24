import {createContext, useCallback, useContext, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {api} from "../services/api";
import type {Employee} from "../types/api";

const STORAGE_KEY = "employee-routes-guest-data";
const STORAGE_VERSION = 1;

interface GuestStorage {version: number; employees: Employee[]}
interface GuestValue {
  active: boolean;
  loading: boolean;
  error?: string;
  employees: Employee[];
  enter: () => Promise<void>;
  exit: () => void;
  setEmployees: (employees: Employee[]) => void;
  restore: () => Promise<void>;
}

const GuestContext = createContext<GuestValue | undefined>(undefined);

function validEmployee(value: unknown): value is Employee {
  if (!value || typeof value !== "object") return false;
  const employee = value as Partial<Employee>;
  return typeof employee.id === "string" && employee.id.length > 0 &&
    typeof employee.name === "string" && typeof employee.address === "string" && typeof employee.phone === "string" &&
    typeof employee.latitude === "number" && Number.isFinite(employee.latitude) && employee.latitude >= -90 && employee.latitude <= 90 &&
    typeof employee.longitude === "number" && Number.isFinite(employee.longitude) && employee.longitude >= -180 && employee.longitude <= 180;
}

function readStored(): Employee[] | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<GuestStorage>;
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.employees) || parsed.employees.some((employee) => !validEmployee(employee))) return undefined;
    return parsed.employees as Employee[];
  } catch { return undefined; }
}

function writeStored(employees: Employee[]): void {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({version: STORAGE_VERSION, employees} satisfies GuestStorage)); } catch { /* session remains usable when browser storage is unavailable */ }
}

export function GuestProvider({children}: {children: ReactNode}) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [employees, setEmployeesState] = useState<Employee[]>([]);

  const setEmployees = useCallback((next: Employee[]) => { setEmployeesState(next); writeStored(next); }, []);
  const enter = useCallback(async () => {
    setLoading(true); setError(undefined);
    try {
      const stored = readStored();
      const next = stored ?? await api.listGuestEmployees();
      if (!stored) writeStored(next);
      setEmployeesState(next);
      setActive(true);
    } catch { setError("Não foi possível iniciar o modo visitante."); }
    finally { setLoading(false); }
  }, []);
  const exit = useCallback(() => { setActive(false); }, []);
  const restore = useCallback(async () => {
    const next = await api.listGuestEmployees();
    setEmployees(next);
  }, [setEmployees]);
  const value = useMemo(() => ({active, loading, error, employees, enter, exit, setEmployees, restore}), [active, loading, error, employees, enter, exit, setEmployees, restore]);
  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
}

export function useGuest(): GuestValue {
  const value = useContext(GuestContext);
  if (!value) throw new Error("useGuest must be used inside GuestProvider");
  return value;
}

export function createGuestEmployeeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `guest-${crypto.randomUUID()}`;
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export {STORAGE_KEY, STORAGE_VERSION};
