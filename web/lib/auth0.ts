import { Auth0Client } from "@auth0/nextjs-auth0/server";

// TODO: required env vars must be set in web/.env.local before running:
//   APP_BASE_URL, AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET
// TODO: in the Auth0 dashboard, set:
//   Allowed Callback URLs → http://localhost:3001/auth/callback
//   Allowed Logout URLs   → http://localhost:3001
export const auth0 = new Auth0Client();
