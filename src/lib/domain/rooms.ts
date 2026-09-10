import type { Project } from "@/types/database";

/**
 * The rooms a buyer can pin a snag to.
 *
 * Derived from the house's own specification rather than a fixed list, so a
 * four-bedroom house offers four bedrooms and an en-suite only appears when
 * there is a second bathroom. A generic list with "Bedroom 5" on a two-bed
 * flat is the kind of detail that makes a form feel like it was not made for
 * the person using it.
 */
export function roomsFor(project: Pick<Project, "bedrooms" | "bathrooms">): string[] {
  const bedrooms = Math.max(1, project.bedrooms ?? 1);
  const bathrooms = project.bathrooms ?? 1;

  const rooms = [
    "Hallway",
    "Living room",
    "Kitchen",
    "Dining area",
    "Utility",
    "WC",
    "Stairs & landing",
  ];

  for (let i = 1; i <= bedrooms; i += 1) {
    rooms.push(i === 1 ? "Main bedroom" : `Bedroom ${i}`);
  }

  rooms.push("Bathroom");
  if (bathrooms >= 2) rooms.push("En-suite");
  if (bathrooms >= 3) rooms.push("Second en-suite");

  rooms.push("Loft", "Garage", "Front exterior", "Rear exterior", "Garden", "Driveway");
  return rooms;
}
