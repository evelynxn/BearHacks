import { auth0 } from "@/lib/auth0";

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <main style={{ padding: "3rem", fontFamily: "system-ui, sans-serif" }}>
        <h1>Echo Journal</h1>
        <p>Pair your device, capture moments, listen back nightly.</p>
        <p>
          <a href="/auth/login?screen_hint=signup">Sign up</a>
          <span> · </span>
          <a href="/auth/login">Log in</a>
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: "3rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Welcome, {session.user.email}</h1>

      {/* TODO(phase4): replace this raw user dump with The Chronicle Feed
          (GraphQL-driven timeline of images + synthesized narratives + audio). */}
      <pre style={{ background: "#f4f4f4", padding: "1rem" }}>
        {JSON.stringify(session.user, null, 2)}
      </pre>

      {/* TODO(phase4): build the photo upload component (multipart POST to
          NEXT_PUBLIC_ORCHESTRATOR_URL/api/client/image). */}

      {/* TODO(phase4): Auth0 Device Authorization Grant pairing UI for the Pi —
          show user_code + verification_uri_complete returned by the orchestrator. */}

      <p>
        <a href="/auth/logout">Log out</a>
      </p>
    </main>
  );
}
