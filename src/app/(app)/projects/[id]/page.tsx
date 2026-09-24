import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { findProject } from "@/lib/projects";
import { requireActiveSession } from "@/server/dal";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActiveSession();
  const { id } = await params;
  const project = findProject(Number(id));
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <Link href="/projects" className="text-sm text-zinc-500 underline-offset-4 hover:underline">
        ← All projects
      </Link>
      <Card>
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-zinc-500">Owner</dt>
            <dd className="font-medium">{project.owner}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-medium">{project.status}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Budget</dt>
            <dd className="font-medium tabular-nums">${project.budget.toLocaleString("en-US")}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{project.summary}</p>
      </Card>
    </div>
  );
}
