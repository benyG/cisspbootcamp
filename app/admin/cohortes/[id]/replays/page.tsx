import { redirect } from "next/navigation";

/** Replays moved to the library (Ben, 12/10): this cohort's view of it. */
export default async function CohortReplaysRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/replays?cohorte=${Number(id) || ""}`);
}
