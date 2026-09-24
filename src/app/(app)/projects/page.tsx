import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { paginateProjects } from "@/lib/projects";
import { requireActiveSession } from "@/server/dal";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await requireActiveSession();
  const { page: rawPage } = await searchParams;
  const { items, page, totalPages } = paginateProjects(Number(Array.isArray(rawPage) ? rawPage[0] : rawPage ?? 1));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Budget</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                <td className="px-4 py-3">
                  <Link href={`/projects/${p.id}`} className="font-medium underline-offset-4 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{p.owner}</td>
                <td className="px-4 py-3">{p.status}</td>
                <td className="px-4 py-3 text-right tabular-nums">${p.budget.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        {page > 1 ? (
          <Link className="underline" href={`/projects?page=${page - 1}`}>Previous</Link>
        ) : (
          <span />
        )}
        <span className="text-zinc-500">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link className="underline" href={`/projects?page=${page + 1}`}>Next</Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
