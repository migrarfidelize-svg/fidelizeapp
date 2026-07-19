import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Use getSession() — reads local storage synchronously after hydration
    // and does not depend on the network. getUser() round-trips to Supabase
    // and can throw on transient failures during a hard refresh, which
    // would bubble up to the root errorComponent ("Ops, algo deu errado").
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) throw redirect({ to: "/auth" });
      return { user: data.session.user };
    } catch (e) {
      // Re-throw TanStack redirects; convert anything else into a safe redirect.
      if (e && typeof e === "object" && ("isRedirect" in e || "to" in e)) throw e;
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
