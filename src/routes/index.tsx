import Header from "@/components/app/header";
import NotesList from "@/components/app/notes-list";
import { client } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@powersync/tanstack-react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { Note } from "@/lib/api";
import { powersyncDrizzle } from "@/lib/powersync";
import { notes } from "@/lib/powersync-schema";
import { eq, desc } from "drizzle-orm";
import { toCompilableQuery } from "@powersync/drizzle-driver";


export const Route = createFileRoute("/")({
  component: RouteComponent,
  // Prevent access to this route if the user is not authenticated
  async beforeLoad() {
    const session = await client.auth.getSession();
    if (!session.data) {
      throw redirect({
        to: "/signin",
      });
    }
  },
});

function useNotes() {
  const session = client.auth.useSession();
  const query = powersyncDrizzle.select().from(notes).where(eq(notes.owner_id, session.data?.user?.id ?? "")).orderBy(desc(notes.created_at));
  
  return useQuery({
    queryKey: queryKeys.notes(),
    enabled: Boolean(session.data?.user?.id),
    query: toCompilableQuery(query),
  });
}

function RouteComponent() {
  const session = client.auth.useSession();
  const { data, error, status, isLoading } = useNotes();

  if (!session.data?.user) {
    return null;
  }

  return (
    <>
      <Header name={session.data.user.name} />
      {(status === "pending" || isLoading) && (
        <div className="text-foreground/70">Loading...</div>
      )}
      {status === "error" && (
        <div className="text-foreground/70">Error: {error.message}</div>
      )}
      {status === "success" && <NotesList notes={data as Note[]} />}
    </>
  );
}
