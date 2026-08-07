// Piccolo involucro attorno a fetch.
//
// L'app attuale gestisce gli errori di rete con `catch` silenziosi, così
// l'utente non sa mai che qualcosa non è riuscito (difetto §7.15). Qui un
// errore è sempre un valore che il chiamante deve gestire: o i dati, o un
// messaggio da mostrare.

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; offline: boolean; status?: number };

export async function api<T>(
  url: string,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    // Tipicamente: telefono senza campo nella sala del corso (§7.16).
    return { ok: false, error: "offline", offline: true };
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      ok: false,
      offline: false,
      status: response.status,
      error: body?.error ?? "generic",
    };
  }

  return { ok: true, data: body as T };
}

export function post<T>(url: string, body?: unknown) {
  return api<T>(url, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
