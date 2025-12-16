import Header from "@/components/app/header";
import NotesList from "@/components/app/notes-list";
import { client } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@powersync/tanstack-react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { Note } from "@/lib/api";

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
  return useQuery({
    queryKey: queryKeys.notes(),
    enabled: Boolean(session.data?.user?.id),
    query: "SELECT id, title, created_at, owner_id, shared FROM notes WHERE owner_id = ? ORDER BY created_at DESC",
    parameters: [session.data?.user?.id],
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
