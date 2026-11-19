// Telemetría de uso del portal (2026-11-19): beacons fire-and-forget al
// backend (`POST /telemetria/evento`). Nunca toca la UI ni lanza errores —
// si no hay cookie de usuario o falla la red, el evento simplemente se pierde.
// Sesión = sessionStorage (una por pestaña del navegador).

const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export type EventoTlm = 'pageview' | 'pestana' | 'consulta_guia' | 'pendientes' | 'export_excel';
export type DetalleTlm = {
  pestana?: 'gerenciales' | 'operacion' | 'trazabilidad';
  seccion?: string;
  origen?: string;
  guia?: string;
};

function sesion(): string {
  try {
    let s = sessionStorage.getItem('tlm_sesion');
    if (!s) {
      s = crypto.randomUUID();
      sessionStorage.setItem('tlm_sesion', s);
    }
    return s;
  } catch {
    return 'sin-sesion';
  }
}

function usuarioCookie(): string | undefined {
  return document.cookie.match(/(^| )usuarioPedidosCookie=([^;]+)/)?.[2];
}

export function registrarEvento(
  evento: EventoTlm,
  detalle: DetalleTlm,
  opts: { clienteId: string; modoExterno: boolean },
): void {
  const usuario = usuarioCookie();
  if (!usuario || !API) return;
  fetch(`${API}/telemetria/evento`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      usuario,
      cliente_id: opts.clienteId,
      modo: opts.modoExterno ? 'externo' : 'interno',
      evento,
      detalle,
      sesion_id: sesion(),
    }),
  }).catch(() => {});
}
