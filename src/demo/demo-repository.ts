import type {Employee} from "../employees/employee.types.js";
import type {EmployeeRepository} from "../database/repository.types.js";

export class DemoEmployeeRepository implements EmployeeRepository {
  constructor(private readonly employees: readonly Employee[]) {}

  async list(_organizationId: string): Promise<Employee[]> {
    return this.employees.map((employee) => ({...employee}));
  }

  async findById(id: string, _organizationId: string): Promise<Employee | undefined> {
    const employee = this.employees.find((candidate) => candidate.id === id);
    return employee ? {...employee} : undefined;
  }

  async findByIds(ids: string[], _organizationId: string): Promise<Employee[]> {
    const byId = new Map(this.employees.map((employee) => [employee.id, employee]));
    return ids.map((id) => byId.get(id)).filter((employee): employee is Employee => Boolean(employee)).map((employee) => ({...employee}));
  }

  async create(): Promise<Employee> {
    throw new Error("Demo employees are read-only.");
  }

  async update(): Promise<Employee | undefined> {
    throw new Error("Demo employees are read-only.");
  }

  async delete(): Promise<boolean> {
    throw new Error("Demo employees are read-only.");
  }
}
