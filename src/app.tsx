import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode, useEffect } from "react";

import { client } from "@/lib/auth";
import { PowerSyncContext } from "@powersync/react";
import { connectPowerSync, disconnectPowerSync, powersync } from "@/lib/powersync";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: {
    accessToken: null,
  },
});

// Create a client
const queryClient = new QueryClient();

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  return (
    <StrictMode>
      <PowerSyncContext.Provider value={powersync}>
        <QueryClientProvider client={queryClient}>
          <PowerSyncAuthBridge />
          <RouterWithAuth />
        </QueryClientProvider>
      </PowerSyncContext.Provider>
    </StrictMode>
  );
}

function PowerSyncAuthBridge() {
  const session = client.auth.useSession();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const userId = session.data?.user?.id;

      if (!userId) {
        await disconnectPowerSync();
        return;
      }

      if (cancelled) {
        return;
      }

      await connectPowerSync();
    })();

    return () => {
      cancelled = true;
    };
  }, [session.data?.user?.id]);

  return null;
}

function RouterWithAuth() {
  return <RouterProvider router={router} />;
}

export default App;
