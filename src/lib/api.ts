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
    // 401 significa che il cookie c'è ma non vale più: sessione scaduta, o
    // account che non esiste più sul server. Va chiusa subito, altrimenti
    // l'interfaccia resta ad aspettare dati che non arriveranno mai.
    if (response.status === 401) {
      const { signOut } = await import("next-auth/react");
      void signOut({ redirect: false });
    }

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

/**
 * Messaggio da mostrare per un errore.
 *
 * Il server manda testi già pronti per i casi che sa spiegare (codice
 * sbagliato, troppi tentativi…). Per tutto il resto — un 500, una risposta
 * senza corpo — non si mostra la chiave tecnica: quella non dice nulla a
 * chi legge. Serve una frase, e per capire davvero cos'è successo ci sono
 * i log del server.
 */
export function errorMessage(
  result: { error: string; offline: boolean },
  t: { genericError: string; networkError: string },
): string {
  if (result.offline) return t.networkError;
  if (!result.error || result.error === "generic") return t.genericError;
  return result.error;
}
