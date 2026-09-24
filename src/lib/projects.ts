export type Project = {
  id: number;
  name: string;
  owner: string;
  status: "Active" | "Paused" | "Done";
  budget: number;
  summary: string;
};

const NAMES = ["Atlas", "Beacon", "Cobalt", "Delta", "Ember", "Falcon", "Granite", "Harbor", "Iris", "Juniper"];
const OWNERS = ["Sam Lee", "Priya Shah", "Diego Ruiz", "Mina Park", "Omar Aziz"];
const STATUSES: Project["status"][] = ["Active", "Paused", "Done"];

/** Deterministic mock data standing in for the application's real domain. */
export const PROJECTS: Project[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  name: `${NAMES[i % NAMES.length]} ${Math.floor(i / NAMES.length) + 1}`,
  owner: OWNERS[i % OWNERS.length],
  status: STATUSES[i % STATUSES.length],
  budget: 10_000 + ((i * 7919) % 90_000),
  summary: "Internal initiative used to demonstrate that protected data is never rendered while the screen is locked.",
}));

export const PAGE_SIZE = 10;

export function paginateProjects(page: number) {
  const totalPages = Math.ceil(PROJECTS.length / PAGE_SIZE);
  const current = Math.min(Math.max(1, Number.isFinite(page) ? Math.trunc(page) : 1), totalPages);
  return {
    items: PROJECTS.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    page: current,
    totalPages,
  };
}

export function findProject(id: number) {
  return PROJECTS.find((p) => p.id === id) ?? null;
}
