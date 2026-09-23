import {useEffect, useRef, useState} from "react";
import {useAuth} from "./AuthContext";

declare global {
  interface Window {
    google?: {accounts: {id: {initialize(options: {client_id: string; callback: (response: {credential: string}) => void}): void; renderButton(element: HTMLElement, options: Record<string, unknown>): void}}};
  }
}

export function GoogleLoginButton() {
  const ref = useRef<HTMLDivElement>(null);
  const {signIn} = useAuth();
  const [error, setError] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    const render = () => {
      if (!window.google || !ref.current) return;
      window.google.accounts.id.initialize({client_id: clientId, callback: ({credential}) => void signIn(credential).catch(() => setError(true))});
      window.google.accounts.id.renderButton(ref.current, {theme: "outline", size: "large", text: "continue_with", width: 280});
    };
    if (window.google) render();
    else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = render;
      script.onerror = () => setError(true);
      document.head.appendChild(script);
    }
  }, [clientId, signIn]);

  if (!clientId) return <p className="muted">Login Google ainda não foi configurado neste ambiente.</p>;
  return <div><div ref={ref} />{error && <p role="alert" className="error-text">Não foi possível entrar com o Google.</p>}</div>;
}

