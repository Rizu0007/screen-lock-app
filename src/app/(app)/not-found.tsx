import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-2 text-sm text-zinc-500">This page does not exist.</p>
      <Link href="/dashboard" className="mt-4 inline-block text-sm underline underline-offset-4">
        Back to dashboard
      </Link>
    </Card>
  );
}
