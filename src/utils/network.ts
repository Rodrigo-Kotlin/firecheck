/**
 * Classificador central de erros de rede.
 *
 * `navigator.onLine` reflete apenas a camada de enlace do navegador —
 * permanece `true` com Wi-Fi conectado mesmo quando DNS/internet está fora.
 * Para decidir se uma falha do Supabase é indisponibilidade real (retry futuro,
 * abrir circuit breaker) ou erro funcional (RLS, validação, conflito), o erro
 * é classificado por esta função.
 *
 * NUNCA classifica como rede:
 *   401 / 403 / 409 / 42501 (RLS), validação, CAS conflict, duplicidade.
 *
 * A string `ERR_NAME_NOT_RESOLVED` normalmente só existe no console do browser,
 * por isso não é dependência obrigatória — o marcador confiável é o reject do
 * `fetch` (`TypeError: Failed to fetch`) e variações de erro de rede.
 */

const NETWORK_MESSAGE_HINTS =
  /failed to fetch|fetch failed|network error|network is down|network request failed|load failed|net::err|econnreset|enotfound|eai_again|etimedout|request timeout|connect timeout|aborted|innererror/i;

/** Códigos que são erros funcionais e NUNCA devem abrir o circuit breaker. */
const FUNCTIONAL_CODES = new Set([
  '401', '403', '409', '422', '42501', '42503',
  '23505', '23514', '22007', '22P02', 'P0001',
  'UNAUTH', 'PERMD', 'NFOUND', 'ALDEL', 'INVSTT',
  'NOTFOUND', 'NOT_APPLIED', 'RATE_LIMITED', 'DUPLICATE',
]);

const NETWORK_CODES = new Set([
  'NETWORK', 'NETWORK_ERROR', 'FETCH_ERROR', 'ERR_NETWORK',
  'ERR_NAME_NOT_RESOLVED', 'ERR_INTERNET_DISCONNECTED',
]);

function asErrorLike(err: unknown): {
  name?: unknown;
  code?: unknown;
  status?: unknown;
  message?: unknown;
} {
  if (typeof err !== 'object' || err === null) return {};
  const e = err as Record<string, unknown>;
  return {
    name: e?.name,
    code: e?.code,
    status: e?.status ?? e?.statusCode,
    message: e?.message,
  };
}

/** Retorna `true` quando o erro comprova indisponibilidade real de rede. */
export function isNetworkUnavailableError(err: unknown): boolean {
  if (err == null) return false;

  const { name, code, status, message } = asErrorLike(err);

  // Fetch rejeitado sem resposta HTTP — o marcador canônico.
  if (err instanceof TypeError) return true;

  if (typeof name === 'string') {
    const n = name.toUpperCase();
    if (n === 'FETCHERROR' || n === 'NETWORKERROR' || n === 'TYPEERROR') return true;
    if (n === 'ABORTERROR') return true;
  }

  if (typeof code === 'string') {
    const c = code.toUpperCase();
    if (FUNCTIONAL_CODES.has(c)) return false;
    if (NETWORK_CODES.has(c)) return true;
  }

  // Resposta HTTP recebida (status 4xx/5xx) => o backend respondeu. Não é rede.
  const statusNum = typeof status === 'number' ? status : Number(status);
  if (Number.isFinite(statusNum) && statusNum >= 400) return false;

  if (typeof message === 'string') {
    const trimmed = message.trim();
    if (trimmed.toLowerCase() === 'failed to fetch') return true;
    if (trimmed.toLowerCase() === 'networkerror') return true;
    if (NETWORK_MESSAGE_HINTS.test(message)) return true;
  }

  return false;
}