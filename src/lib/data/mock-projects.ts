import type { Project } from "@/lib/procore/types";

export const mockProjects: Project[] = [
  {
    id: "project-101",
    name: "Downtown Feeder Upgrade",
    payItems: [
      {
        id: "pi-101-01",
        code: "260519",
        name: "Low Voltage Conductors",
        budgetedQuantity: 12500,
        unitOfMeasure: "LF"
      },
      {
        id: "pi-101-02",
        code: "260526",
        name: "Grounding and Bonding",
        budgetedQuantity: 420,
        unitOfMeasure: "EA"
      },
      {
        id: "pi-101-03",
        code: "260533",
        name: "Raceways and Boxes",
        budgetedQuantity: 3100,
        unitOfMeasure: "LF"
      }
    ]
  },
  {
    id: "project-202",
    name: "North Service Yard",
    payItems: [
      {
        id: "pi-202-01",
        code: "265100",
        name: "Interior Lighting",
        budgetedQuantity: 180,
        unitOfMeasure: "EA"
      },
      {
        id: "pi-202-02",
        code: "262416",
        name: "Panelboards",
        budgetedQuantity: 12,
        unitOfMeasure: "EA"
      }
    ]
  }
];
