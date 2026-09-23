import {getDatabase} from "../database/database.js";
import { optimizeEmployeeRoutes } from "./employee-route-optimization.service.js";
import { LocationIQRoutingProvider } from "../routing/providers/locationiq-routing.provider.js";
import type { Employee } from "../employees/employee.types.js";
import type { RoutingPoint } from "../routing/routing.types.js";
import { company } from "../company/company.config.js";

// Ajuste APENAS estes imports/nome da classe caso o projeto
// exporte o banco ou provider com nomes diferentes.
// Não altere a lógica do teste por causa disso.

async function main() {
  console.log("\n========================================");
  console.log("🚗 TESTE FINAL DO MOTOR DE OTIMIZAÇÃO");
  console.log("========================================\n");

  // --------------------------------------------------
  // 1. ORIGEM
  // --------------------------------------------------

  // Use aqui as coordenadas REAIS da empresa que você já
  // utiliza nos outros testes do projeto.
  //
  // NÃO use estas coordenadas de exemplo sem substituir.
  const origin: RoutingPoint = {
    id: "company",
    latitude: company.coordinates.latitude,
    longitude: company.coordinates.longitude,
  }

  // --------------------------------------------------
  // 2. BUSCAR FUNCIONÁRIOS CADASTRADOS
  // --------------------------------------------------

  const employees = getDatabase()
    .prepare(`
      SELECT
        id,
        name,
        address,
        phone,
        latitude,
        longitude
      FROM employees
      ORDER BY id
    `)
    .all() as Employee[];

  console.log(`Funcionários encontrados: ${employees.length}\n`);

  if (employees.length === 0) {
    throw new Error("Nenhum funcionário cadastrado.");
  }

  // Avoid logging addresses and other contact details.

  // --------------------------------------------------
  // 3. PROVIDER
  // --------------------------------------------------

  const routingProvider = new LocationIQRoutingProvider();

  console.log("\nCalculando grupos e rotas...");
  console.log("Isso pode demorar por causa do rate limit.\n");

  // --------------------------------------------------
  // 4. EXECUTAR O MOTOR
  // --------------------------------------------------

  const result = await optimizeEmployeeRoutes(
    origin,
    employees,
    routingProvider,
  );

  // --------------------------------------------------
  // 5. MOSTRAR RESULTADO
  // --------------------------------------------------

  console.log("\n========================================");
  console.log("📍 RESULTADO");
  console.log("========================================");

  for (const group of result.groups) {
    console.log(`\n🚗 GRUPO ${group.groupNumber}`);
    console.log("----------------------------------------");

    console.log(
      `Funcionários: ${group.employees
        .map((employee) => employee.name)
        .join(", ")}`,
    );

    // Converte IDs da stopOrder para nomes.
    const stopOrderNames = group.stopOrder.map((pointId) => {
      if (pointId === origin.id) {
        return "EMPRESA";
      }

      const employee = group.employees.find(
        (employee) => employee.id === pointId,
      );

      return employee?.name ?? pointId;
    });

    console.log(`Ordem: ${stopOrderNames.join(" → ")}`);

    console.log(
      `Duração: ${(group.totalDurationSeconds / 60).toFixed(2)} min`,
    );

    console.log(
      `Distância: ${(group.totalDistanceMeters / 1000).toFixed(2)} km`,
    );

    console.log(
      `Extra médio: ${(
        group.averageExtraDurationSeconds / 60
      ).toFixed(2)} min`,
    );

    console.log(
      `Extra máximo: ${(
        group.maxExtraDurationSeconds / 60
      ).toFixed(2)} min`,
    );

    console.log(
      `Status: ${group.acceptable ? "✅ ACCEPTED" : "❌ REJECTED"}`,
    );

    // ------------------------------------------------
    // MÉTRICAS POR PASSAGEIRO
    // ------------------------------------------------

    console.log("\nPassageiros:");

    for (const metric of group.passengerMetrics) {
      const employee = group.employees.find(
        (employee) => employee.id === metric.pointId,
      );

      console.log(
        `  ${employee?.name ?? metric.pointId}`,
      );

      console.log(
        `    Direto: ${(metric.directDurationSeconds / 60).toFixed(2)} min`,
      );

      console.log(
        `    Compartilhado: ${(
          metric.sharedDurationSeconds / 60
        ).toFixed(2)} min`,
      );

      console.log(
        `    Desvio: ${(metric.extraDurationSeconds / 60).toFixed(2)} min`,
      );
    }

    // ------------------------------------------------
    // VIOLAÇÕES
    // ------------------------------------------------

    if (group.violations.length > 0) {
      console.log("\n⚠️ Violações:");

      for (const violation of group.violations) {
        const employee = group.employees.find(
          (employee) => employee.id === violation.pointId,
        );

        console.log(
          `  ${employee?.name ?? violation.pointId}`,
        );

        console.log(`    Tipo: ${violation.type}`);

        console.log(
          `    Valor: ${(violation.actualValue / 60).toFixed(2)} min`,
        );

        console.log(
          `    Limite: ${(violation.limit / 60).toFixed(2)} min`,
        );
      }
    }
  }

  // --------------------------------------------------
  // 6. RESUMO
  // --------------------------------------------------

  console.log("\n========================================");
  console.log("📊 RESUMO");
  console.log("========================================\n");

  console.log(
    `Funcionários: ${result.summary.totalEmployees}`,
  );

  console.log(
    `Carros/grupos: ${result.summary.totalGroups}`,
  );

  console.log(
    `Ocupação média: ${result.summary.averageOccupancy.toFixed(2)}`,
  );

  console.log(
    `Grupos aceitos: ${result.summary.acceptableGroups}`,
  );

  console.log(
    `Grupos rejeitados: ${result.summary.rejectedGroups}`,
  );

  // --------------------------------------------------
  // 7. SANITY CHECK
  // --------------------------------------------------

  console.log("Issues:", result.issues.map(issue => issue.type === "UNROUTABLE_EMPLOYEE" ? issue : ({type: issue.type, groupNumber: issue.groupNumber, employeeIds: issue.employees.map(e => e.id), reason: issue.reason, relations: issue.relations})));
  console.log("Unavailable groups:", result.summary.unavailableGroups);
  console.log("Unroutable employees:", result.summary.unroutableEmployees);
  const returnedEmployeeIds = [
    ...result.groups.flatMap(group => group.employees.map(employee => employee.id)),
    ...result.issues.flatMap(issue => issue.type === "UNROUTABLE_EMPLOYEE"
      ? [issue.employeeId] : issue.employees.map(employee => employee.id)),
  ];

  const uniqueEmployeeIds = new Set(returnedEmployeeIds);

  console.log("\n========================================");
  console.log("🔎 VERIFICAÇÕES");
  console.log("========================================\n");

  console.log(
    `Entrada: ${employees.length} funcionários`,
  );

  console.log(
    `Saída: ${returnedEmployeeIds.length} funcionários`,
  );

  console.log(
    `Únicos: ${uniqueEmployeeIds.size} funcionários`,
  );

  if (returnedEmployeeIds.length !== employees.length) {
    throw new Error(
      "❌ A quantidade de funcionários da saída é diferente da entrada.",
    );
  }

  if (uniqueEmployeeIds.size !== employees.length) {
    throw new Error(
      "❌ Existem funcionários duplicados entre os grupos.",
    );
  }

  const inputIds = new Set(employees.map((employee) => employee.id));

  for (const id of inputIds) {
    if (!uniqueEmployeeIds.has(id)) {
      throw new Error(
        `❌ Funcionário ${id} desapareceu durante a otimização.`,
      );
    }
  }

  console.log("✅ Todos os funcionários foram preservados.");
  console.log("✅ Nenhum funcionário foi duplicado.");

  console.log("\n========================================");
  console.log("🏁 TESTE FINALIZADO");
  console.log("========================================\n");
}

main().catch((error) => {
  console.error("\n❌ ERRO NO TESTE FINAL\n");
  console.error(error);

  process.exitCode = 1;
});
