import type {Employee} from "../employees/employee.types.js";

// These are representative public points for the named neighbourhoods/roads,
// validated against OpenStreetMap's public geocoder. They are deliberately
// fictitious records and are never written to an organization database.
export const DEMO_EMPLOYEES: readonly Employee[] = [
  {id: "demo-01", name: "Lucas Almeida", phone: "(81) 99000-0001", address: "Rua da Matriz, Centro, Cabo de Santo Agostinho - PE", latitude: -8.2889472, longitude: -35.0364626},
  {id: "demo-02", name: "Matheus Silva", phone: "(81) 99000-0002", address: "Av. Historiador Pereira da Costa, Centro, Cabo de Santo Agostinho - PE", latitude: -8.2889472, longitude: -35.0364626},
  {id: "demo-03", name: "Gabriel Santos", phone: "(81) 99000-0003", address: "Rua Dois Carneiros, Jaboatão dos Guararapes - PE", latitude: -8.1133211, longitude: -34.9704446},
  {id: "demo-04", name: "João Henrique", phone: "(81) 99000-0004", address: "Estrada da Batalha, Prazeres, Jaboatão dos Guararapes - PE", latitude: -8.1597127, longitude: -34.9259619},
  {id: "demo-05", name: "Pedro Oliveira", phone: "(81) 99000-0005", address: "Av. Barreto de Menezes, Prazeres, Jaboatão dos Guararapes - PE", latitude: -8.1597127, longitude: -34.9259619},
  {id: "demo-06", name: "Rafael Costa", phone: "(81) 99000-0006", address: "Av. Ayrton Senna, Piedade, Jaboatão dos Guararapes - PE", latitude: -8.1756855, longitude: -34.9187594},
  {id: "demo-07", name: "Daniel Souza", phone: "(81) 99000-0007", address: "Av. Bernardo Vieira de Melo, Piedade, Jaboatão dos Guararapes - PE", latitude: -8.1756855, longitude: -34.9187594},
  {id: "demo-08", name: "Felipe Martins", phone: "(81) 99000-0008", address: "Av. Presidente Kennedy, Candeias, Jaboatão dos Guararapes - PE", latitude: -8.1960289, longitude: -34.9291341},
  {id: "demo-09", name: "André Lima", phone: "(81) 99000-0009", address: "Av. Ulisses Montarroyos, Candeias, Jaboatão dos Guararapes - PE", latitude: -8.1960289, longitude: -34.9291341},
  {id: "demo-10", name: "Bruno Ferreira", phone: "(81) 99000-0010", address: "PE-60, Ponte dos Carvalhos, Cabo de Santo Agostinho - PE", latitude: -8.2368516, longitude: -34.9986935},
  {id: "demo-11", name: "Thiago Rodrigues", phone: "(81) 99000-0011", address: "PE-28, Gaibu, Cabo de Santo Agostinho - PE", latitude: -8.3384357, longitude: -34.9617449},
  {id: "demo-12", name: "Vinícius Carvalho", phone: "(81) 99000-0012", address: "Av. Beira Mar, Gaibu, Cabo de Santo Agostinho - PE", latitude: -8.3384357, longitude: -34.9617449},
  {id: "demo-13", name: "Gustavo Barbosa", phone: "(81) 99000-0013", address: "Rua da Praia, Gaibu, Cabo de Santo Agostinho - PE", latitude: -8.3406117, longitude: -34.9512658},
  {id: "demo-14", name: "Eduardo Melo", phone: "(81) 99000-0014", address: "PE-28, Itapuama, Cabo de Santo Agostinho - PE", latitude: -8.2990223, longitude: -34.9584317},
  {id: "demo-15", name: "Leonardo Alves", phone: "(81) 99000-0015", address: "Rua Dois Carneiros, Dois Carneiros, Jaboatão dos Guararapes - PE", latitude: -8.1133211, longitude: -34.9704446},
  {id: "demo-16", name: "Caio Nascimento", phone: "(81) 99000-0016", address: "Ponte dos Carvalhos, Cabo de Santo Agostinho - PE", latitude: -8.2368516, longitude: -34.9986935},
  {id: "demo-17", name: "Samuel Gomes", phone: "(81) 99000-0017", address: "Centro, Cabo de Santo Agostinho - PE", latitude: -8.2889472, longitude: -35.0364626},
  {id: "demo-18", name: "Henrique Araújo", phone: "(81) 99000-0018", address: "Pontezinha, Cabo de Santo Agostinho - PE", latitude: -8.2239936, longitude: -34.9643781},
  {id: "demo-19", name: "Murilo Correia", phone: "(81) 99000-0019", address: "Gaibu, Cabo de Santo Agostinho - PE", latitude: -8.3384357, longitude: -34.9617449},
  {id: "demo-20", name: "Diego Ribeiro", phone: "(81) 99000-0020", address: "Av. Beira Mar, Gaibu, Cabo de Santo Agostinho - PE", latitude: -8.3406117, longitude: -34.9512658},
  {id: "demo-21", name: "Marcos Vinícius", phone: "(81) 99000-0021", address: "Charneca, Cabo de Santo Agostinho - PE", latitude: -8.2962408, longitude: -35.0463009},
  {id: "demo-22", name: "Renato Moura", phone: "(81) 99000-0022", address: "Cohab, Cabo de Santo Agostinho - PE", latitude: -8.2929868, longitude: -35.0282818},
  {id: "demo-23", name: "Victor Hugo", phone: "(81) 99000-0023", address: "Garapu, Cabo de Santo Agostinho - PE", latitude: -8.2995598, longitude: -35.0207168},
  {id: "demo-24", name: "Wesley Andrade", phone: "(81) 99000-0024", address: "Pontezinha, Cabo de Santo Agostinho - PE", latitude: -8.2239936, longitude: -34.9643781},
  {id: "demo-25", name: "Rodrigo Freitas", phone: "(81) 99000-0025", address: "Prazeres, Jaboatão dos Guararapes - PE", latitude: -8.1597127, longitude: -34.9259619},
  {id: "demo-26", name: "Leandro Monteiro", phone: "(81) 99000-0026", address: "Cajueiro Seco, Jaboatão dos Guararapes - PE", latitude: -8.1708244, longitude: -34.9302827},
  {id: "demo-27", name: "Arthur Cavalcanti", phone: "(81) 99000-0027", address: "Piedade, Jaboatão dos Guararapes - PE", latitude: -8.1756855, longitude: -34.9187594},
  {id: "demo-28", name: "Igor Fernandes", phone: "(81) 99000-0028", address: "Candeias, Jaboatão dos Guararapes - PE", latitude: -8.1960289, longitude: -34.9291341},
  {id: "demo-29", name: "Paulo Henrique", phone: "(81) 99000-0029", address: "Barra de Jangada, Jaboatão dos Guararapes - PE", latitude: -8.2166117, longitude: -34.9319705},
  {id: "demo-30", name: "Allan Moreira", phone: "(81) 99000-0030", address: "Barra de Jangada, Jaboatão dos Guararapes - PE", latitude: -8.2166117, longitude: -34.9319705},
];

export const DEMO_EMPLOYEE_IDS = new Set(DEMO_EMPLOYEES.map((employee) => employee.id));
