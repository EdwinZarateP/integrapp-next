'use client';

import { GoogleOAuthProvider } from "@react-oauth/google";
import { ProveedorVariables } from "@/Contexto/index";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId="870542988514-rbpof111fdk5vlbn75vi62i06moko46s.apps.googleusercontent.com">
      <ProveedorVariables hijo={children} />
    </GoogleOAuthProvider>
  );
}
