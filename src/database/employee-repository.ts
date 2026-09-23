import {getDatabase} from "./database.js";
import type {Employee} from "../employees/employee.types.js";
import type {EmployeeRepository} from "./repository.types.js";
import {PostgresEmployeeRepository} from "./postgres-repositories.js";

export interface LegacyEmployeeStore {
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get?(...params: unknown[]): unknown;
    run?(...params: unknown[]): {changes: number};
  };
}

class LegacyEmployeeRepository implements EmployeeRepository {
  constructor(private readonly store: LegacyEmployeeStore) {}

  async list(_organizationId: string): Promise<Employee[]> {
    return this.store.prepare("SELECT * FROM employees ORDER BY id").all() as Employee[];
  }

  async findById(id: string, _organizationId: string): Promise<Employee | undefined> {
    return this.store.prepare("SELECT * FROM employees WHERE id = ?").get?.(id) as Employee | undefined;
  }

  async findByIds(ids: string[], _organizationId: string): Promise<Employee[]> {
    const byId = new Map((await this.list("legacy")).map((employee) => [employee.id, employee]));
    return ids.map((id) => byId.get(id)).filter((employee): employee is Employee => Boolean(employee));
  }

  async create(employee: Employee, _organizationId: string): Promise<Employee> {
    this.store.prepare("INSERT INTO employees (id, name, address, phone, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)").run?.(
      employee.id, employee.name, employee.address, employee.phone, employee.latitude, employee.longitude,
    );
    return employee;
  }

  async update(id: string, _organizationId: string, employee: Omit<Employee, "id">): Promise<Employee | undefined> {
    const result = this.store.prepare(`UPDATE employees SET name = ?, address = ?, phone = ?, latitude = ?, longitude = ? WHERE id = ?`).run?.(
      employee.name, employee.address, employee.phone, employee.latitude, employee.longitude, id,
    );
    if (!result || result.changes === 0) return undefined;
    return {id, ...employee};
  }

  async delete(id: string, _organizationId: string): Promise<boolean> {
    return (this.store.prepare("DELETE FROM employees WHERE id = ?").run?.(id)?.changes ?? 0) > 0;
  }
}

export function fromLegacyEmployeeStore(store: LegacyEmployeeStore): EmployeeRepository {
  return new LegacyEmployeeRepository(store);
}

export function createDefaultEmployeeRepository(): EmployeeRepository {
  if (process.env.DATABASE_URL) {
    return new PostgresEmployeeRepository();
  }
  return fromLegacyEmployeeStore(getDatabase());
}

