import { createCandidateGroups } from "./grouping.service.js";

const employees = [
  {
    employee: {
      id: "A",
      name: "A",
      address: "",
      phone: "",
      latitude: 0,
      longitude: 0
    },
    distanceFromCompany: 7,
    bearingFromCompany: 38
  },
  {
    employee: {
      id: "B",
      name: "B",
      address: "",
      phone: "",
      latitude: 0,
      longitude: 0
    },
    distanceFromCompany: 10,
    bearingFromCompany: 41
  },
  {
    employee: {
      id: "C",
      name: "C",
      address: "",
      phone: "",
      latitude: 0,
      longitude: 0
    },
    distanceFromCompany: 14,
    bearingFromCompany: 44
  },
  {
    employee: {
      id: "D",
      name: "D",
      address: "",
      phone: "",
      latitude: 0,
      longitude: 0
    },
    distanceFromCompany: 18,
    bearingFromCompany: 49
  },
  {
    employee: {
      id: "E",
      name: "E",
      address: "",
      phone: "",
      latitude: 0,
      longitude: 0
    },
    distanceFromCompany: 6,
    bearingFromCompany: 215
  },
  {
    employee: {
      id: "F",
      name: "F",
      address: "",
      phone: "",
      latitude: 0,
      longitude: 0
    },
    distanceFromCompany: 11,
    bearingFromCompany: 220
  },
  {
    employee: {
      id: "G",
      name: "G",
      address: "",
      phone: "",
      latitude: 0,
      longitude: 0
    },
    distanceFromCompany: 16,
    bearingFromCompany: 225
  },
  {
    employee: {
      id: "H",
      name: "H",
      address: "",
      phone: "",
      latitude: 0,
      longitude: 0
    },
    distanceFromCompany: 8,
    bearingFromCompany: 102
  },
  {
    employee: {
      id: "I",
      name: "I",
      address: "",
      phone: "",
      latitude: 0,
      longitude: 0
    },
    distanceFromCompany: 13,
    bearingFromCompany: 108
  },
  {
    employee: {
      id: "J",
      name: "J",
      address: "",
      phone: "",
      latitude: 0,
      longitude: 0
    },
    distanceFromCompany: 9,
    bearingFromCompany: 355
  }
];

const groups = createCandidateGroups(employees);

for (const group of groups) {
  console.log(
    group.employees.map(
      (item) => item.employee.name
    )
  );
}