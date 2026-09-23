import type {Employee} from "../employees/employee.types.js";

export interface EmployeeRepository {
  list(organizationId: string): Promise<Employee[]>;
  findById(id: string, organizationId: string): Promise<Employee | undefined>;
  findByIds(ids: string[], organizationId: string): Promise<Employee[]>;
  create(employee: Employee, organizationId: string): Promise<Employee>;
  update(id: string, organizationId: string, employee: Omit<Employee, "id">): Promise<Employee | undefined>;
  delete(id: string, organizationId: string): Promise<boolean>;
}

export type UserRole = "ADMIN" | "OPERATOR";

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: UserRole;
  email: string;
  name: string;
  avatarUrl?: string;
  organizationName: string;
}

export interface GoogleIdentity {
  subject: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface AuthRepository {
  upsertGoogleIdentity(identity: GoogleIdentity): Promise<AuthContext>;
  findByGoogleSubject(subject: string): Promise<AuthContext | undefined>;
}

