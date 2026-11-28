import type {Employee} from "../employees/employee.types.js";
import type {EmployeeRepository} from "./repository.types.js";

/**
 * Tenant-aware in-memory EmployeeRepository for tests. It follows the same
 * contract as PostgresEmployeeRepository: every call is scoped to an organization.
 */
export class InMemoryEmployeeRepository implements EmployeeRepository {
  private readonly rows = new Map<string, Map<string, Employee>>();

  constructor(seed: Record<string, Employee[]> = {}) {
    for (const [organizationId, employees] of Object.entries(seed)) {
      for (const employee of employees) this.tenant(organizationId).set(employee.id, {...employee});
    }
  }

  private tenant(organizationId: string): Map<string, Employee> {
    let rows = this.rows.get(organizationId);
    if (!rows) { rows = new Map(); this.rows.set(organizationId, rows); }
    return rows;
  }

  async list(organizationId: string): Promise<Employee[]> {
    return [...this.tenant(organizationId).values()].sort((a, b) => a.id.localeCompare(b.id)).map((employee) => ({...employee}));
  }

  async findById(id: string, organizationId: string): Promise<Employee | undefined> {
    const employee = this.tenant(organizationId).get(id);
    return employee ? {...employee} : undefined;
  }

  async findByIds(ids: string[], organizationId: string): Promise<Employee[]> {
    const rows = this.tenant(organizationId);
    return ids.flatMap((id) => { const employee = rows.get(id); return employee ? [{...employee}] : []; });
  }

  async create(employee: Employee, organizationId: string): Promise<Employee> {
    this.tenant(organizationId).set(employee.id, {...employee});
    return {...employee};
  }

  async update(id: string, organizationId: string, employee: Omit<Employee, "id">): Promise<Employee | undefined> {
    const rows = this.tenant(organizationId);
    if (!rows.has(id)) return undefined;
    const updated = {id, ...employee};
    rows.set(id, updated);
    return {...updated};
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    return this.tenant(organizationId).delete(id);
  }
}
