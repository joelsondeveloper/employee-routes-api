import {Router, type Request, type Response} from "express";
import {DEMO_EMPLOYEES} from "./demo-employees.js";
import {DemoEmployeeRepository} from "./demo-repository.js";
import {createOptimizationRouter, type OptimizationRouteDependencies} from "../optimization/optimization.routes.js";

export interface DemoRouteDependencies {
  employees?: readonly import("../employees/employee.types.js").Employee[];
  optimization?: OptimizationRouteDependencies;
}

export function createDemoRouter(dependencies: DemoRouteDependencies = {}): Router {
  const employees = dependencies.employees ?? DEMO_EMPLOYEES;
  const repository = new DemoEmployeeRepository(employees);
  const router = Router();
  router.get("/employees", (_request: Request, response: Response) => response.json(employees));
  router.use("/routes", createOptimizationRouter({...dependencies.optimization, employeeRepository: repository}));
  return router;
}
