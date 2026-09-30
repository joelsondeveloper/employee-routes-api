import type {Employee} from "../employees/employee.types.js";

// These are representative public points for the named neighbourhoods/roads,
// validated against OpenStreetMap's public geocoder. They are deliberately
// fictitious records and are never written to an organization database.
// When a full street/number was not indexed, the coordinate uses a nearby
// representative point in Prazeres while the supplied address remains intact.
export const DEMO_EMPLOYEES: readonly Employee[] = [
  {id: "demo-01", name: "Lucas Almeida", phone: "(81) 99000-0001", address: "Avenida Historiador Pereira da Costa, 594, Centro, Cabo de Santo Agostinho - PE, 54510-360", latitude: -8.2805167, longitude: -35.0307649},
  {id: "demo-02", name: "Matheus Silva", phone: "(81) 99000-0002", address: "Avenida Historiador Pereira da Costa, 109, Centro, Cabo de Santo Agostinho - PE, 54510-903", latitude: -8.2805167, longitude: -35.0307649},
  {id: "demo-03", name: "Gabriel Santos", phone: "(81) 99000-0003", address: "Estrada da Batalha, 36, Prazeres, Jaboatão dos Guararapes - PE, 54325-035", latitude: -8.1451555, longitude: -34.9182695},
  {id: "demo-04", name: "João Henrique", phone: "(81) 99000-0004", address: "Estrada da Batalha, 1009, Prazeres, Jaboatão dos Guararapes - PE, 54315-010", latitude: -8.1534909, longitude: -34.9197577},
  {id: "demo-05", name: "Pedro Oliveira", phone: "(81) 99000-0005", address: "Avenida Barreto de Menezes, 1009, Prazeres, Jaboatão dos Guararapes - PE, 54310-310", latitude: -8.1613467, longitude: -34.9270006},
  {id: "demo-06", name: "Rafael Costa", phone: "(81) 99000-0006", address: "Avenida Bernardo Vieira de Melo, 3134, Piedade, Jaboatão dos Guararapes - PE, 54410-010", latitude: -8.1814912, longitude: -34.918472},
  {id: "demo-07", name: "Daniel Souza", phone: "(81) 99000-0007", address: "Avenida Bernardo Vieira de Melo, Piedade, Jaboatão dos Guararapes - PE, 54400-000", latitude: -8.1718197, longitude: -34.9160407},
  {id: "demo-08", name: "Felipe Martins", phone: "(81) 99000-0008", address: "Avenida Bernardo Vieira de Melo, Candeias, Jaboatão dos Guararapes - PE", latitude: -8.2050272, longitude: -34.917659},
  {id: "demo-09", name: "André Lima", phone: "(81) 99000-0009", address: "Avenida Bernardo Vieira de Melo, Barra de Jangada, Jaboatão dos Guararapes - PE", latitude: -8.2177093, longitude: -34.9219077},
  {id: "demo-10", name: "Bruno Ferreira", phone: "(81) 99000-0010", address: "Avenida Estudante dos Guararapes, Prazeres, Jaboatão dos Guararapes - PE, 54315-000", latitude: -8.161069, longitude: -34.9268033},
  {id: "demo-11", name: "Thiago Rodrigues", phone: "(81) 99000-0011", address: "Avenida Armindo Moura, Prazeres, Jaboatão dos Guararapes - PE, 54315-003", latitude: -8.1471871, longitude: -34.9181648},
  {id: "demo-12", name: "Vinícius Carvalho", phone: "(81) 99000-0012", address: "Rua Dezenove de Abril, Prazeres, Jaboatão dos Guararapes - PE, 54315-015", latitude: -8.1597127, longitude: -34.9259619},
];

export const DEMO_EMPLOYEE_IDS = new Set(DEMO_EMPLOYEES.map((employee) => employee.id));
