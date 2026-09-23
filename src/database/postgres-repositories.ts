import {Pool} from "pg";
import {randomUUID} from "node:crypto";
import type {Employee} from "../employees/employee.types.js";
import type {AuthContext, AuthRepository, EmployeeRepository, GoogleIdentity, UserRole} from "./repository.types.js";

export function createPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for PostgreSQL.");
  return new Pool({connectionString, max: Number(process.env.DATABASE_POOL_MAX ?? 10), connectionTimeoutMillis: 10_000});
}

function employeeFromRow(row: Record<string, unknown>): Employee {
  return {
    id: String(row.id),
    name: String(row.name),
    address: String(row.address),
    phone: String(row.phone),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
  };
}

export class PostgresEmployeeRepository implements EmployeeRepository {
  constructor(private readonly pool: Pool = createPostgresPool()) {}

  async list(organizationId: string): Promise<Employee[]> {
    const result = await this.pool.query("SELECT id, name, address, phone, latitude, longitude FROM employees WHERE organization_id = $1 ORDER BY id", [organizationId]);
    return result.rows.map(employeeFromRow);
  }

  async findById(id: string, organizationId: string): Promise<Employee | undefined> {
    const result = await this.pool.query("SELECT id, name, address, phone, latitude, longitude FROM employees WHERE id = $1 AND organization_id = $2", [id, organizationId]);
    return result.rows[0] ? employeeFromRow(result.rows[0]) : undefined;
  }

  async findByIds(ids: string[], organizationId: string): Promise<Employee[]> {
    if (ids.length === 0) return [];
    const result = await this.pool.query("SELECT id, name, address, phone, latitude, longitude FROM employees WHERE organization_id = $1 AND id = ANY($2::text[])", [organizationId, ids]);
    const byId = new Map(result.rows.map((row) => [String(row.id), employeeFromRow(row)]));
    return ids.map((id) => byId.get(id)).filter((employee): employee is Employee => Boolean(employee));
  }

  async create(employee: Employee, organizationId: string): Promise<Employee> {
    await this.pool.query("INSERT INTO employees (id, organization_id, name, address, phone, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7)", [employee.id, organizationId, employee.name, employee.address, employee.phone, employee.latitude, employee.longitude]);
    return employee;
  }

  async update(id: string, organizationId: string, employee: Omit<Employee, "id">): Promise<Employee | undefined> {
    const result = await this.pool.query("UPDATE employees SET name = $1, address = $2, phone = $3, latitude = $4, longitude = $5, updated_at = NOW() WHERE id = $6 AND organization_id = $7 RETURNING id, name, address, phone, latitude, longitude", [employee.name, employee.address, employee.phone, employee.latitude, employee.longitude, id, organizationId]);
    return result.rows[0] ? employeeFromRow(result.rows[0]) : undefined;
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM employees WHERE id = $1 AND organization_id = $2", [id, organizationId]);
    return (result.rowCount ?? 0) > 0;
  }
}

function contextFromRow(row: Record<string, unknown>): AuthContext {
  const avatarUrl = row.avatar_url ? String(row.avatar_url) : undefined;
  return {
    userId: String(row.user_id),
    organizationId: String(row.organization_id),
    role: String(row.role) as UserRole,
    email: String(row.email),
    name: String(row.name),
    ...(avatarUrl ? {avatarUrl} : {}),
    organizationName: String(row.organization_name),
  };
}

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly pool: Pool = createPostgresPool()) {}

  async upsertGoogleIdentity(identity: GoogleIdentity): Promise<AuthContext> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT id FROM users WHERE google_subject = $1", [identity.subject]);
      let userId: string;
      let organizationId: string;
      if (existing.rows[0]) {
        userId = String(existing.rows[0].id);
        await client.query("UPDATE users SET email = $1, name = $2, avatar_url = $3, updated_at = NOW() WHERE id = $4", [identity.email, identity.name, identity.avatarUrl ?? null, userId]);
        const membership = await client.query("SELECT organization_id FROM memberships WHERE user_id = $1 ORDER BY created_at LIMIT 1", [userId]);
        if (!membership.rows[0]) {
          organizationId = randomUUID();
          await client.query("INSERT INTO organizations (id, name) VALUES ($1, $2)", [organizationId, "Minha organização"]);
          await client.query("INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'ADMIN')", [userId, organizationId]);
        } else organizationId = String(membership.rows[0].organization_id);
      } else {
        userId = randomUUID();
        organizationId = randomUUID();
        await client.query("INSERT INTO users (id, google_subject, email, name, avatar_url) VALUES ($1, $2, $3, $4, $5)", [userId, identity.subject, identity.email, identity.name, identity.avatarUrl ?? null]);
        await client.query("INSERT INTO organizations (id, name) VALUES ($1, $2)", [organizationId, "Minha organização"]);
        await client.query("INSERT INTO memberships (user_id, organization_id, role) VALUES ($1, $2, 'ADMIN')", [userId, organizationId]);
      }
      const context = await this.contextForUser(client, userId, organizationId);
      await client.query("COMMIT");
      return context;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findByGoogleSubject(subject: string): Promise<AuthContext | undefined> {
    const result = await this.pool.query(`SELECT u.id AS user_id, u.email, u.name, u.avatar_url, o.id AS organization_id, o.name AS organization_name, m.role
      FROM users u JOIN memberships m ON m.user_id = u.id JOIN organizations o ON o.id = m.organization_id
      WHERE u.google_subject = $1 ORDER BY m.created_at LIMIT 1`, [subject]);
    return result.rows[0] ? contextFromRow(result.rows[0]) : undefined;
  }

  private async contextForUser(client: {query: (text: string, values?: unknown[]) => Promise<{rows: Record<string, unknown>[]}>}, userId: string, organizationId: string): Promise<AuthContext> {
    const result = await client.query(`SELECT u.id AS user_id, u.email, u.name, u.avatar_url, o.id AS organization_id, o.name AS organization_name, m.role
      FROM users u JOIN memberships m ON m.user_id = u.id JOIN organizations o ON o.id = m.organization_id
      WHERE u.id = $1 AND o.id = $2 LIMIT 1`, [userId, organizationId]);
    if (!result.rows[0]) throw new Error("Created user membership could not be loaded.");
    return contextFromRow(result.rows[0]);
  }
}

