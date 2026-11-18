import { API_URL } from '../../api';

// ======================================================
// TOKEN DE ACESSO
// ======================================================

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Chamado quando uma requisição autenticada recebe 401 (token expirado/inválido). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

// ======================================================
// ERROS
// ======================================================

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const NETWORK_ERROR_MESSAGE =
  'Não foi possível conectar ao servidor. Verifique sua conexão e se a API do AICare está em execução.';

function extractErrorMessage(data: unknown, status: number) {
  const detail = (data as { detail?: unknown } | null)?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  // Erros de validação do FastAPI: lista de { msg, loc, ... }.
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) =>
        String((item as { msg?: string }).msg ?? '').replace(
          /^Value error, /,
          '',
        ),
      )
      .filter(Boolean)
      .join('\n');
  }

  return `Erro inesperado do servidor (${status}).`;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function encodeForm(values: Record<string, string>) {
  return Object.entries(values)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
}

// ======================================================
// REQUISIÇÕES
// ======================================================

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Corpo enviado como JSON. */
  body?: unknown;
  /** Corpo enviado como formulário (application/x-www-form-urlencoded). */
  form?: Record<string, string>;
  /** Envia o token de acesso (padrão: true). */
  auth?: boolean;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const useAuth = options.auth !== false;
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: string | undefined;

  if (options.form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = encodeForm(options.form);
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  if (useAuth && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body,
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? parseJson(text) : null;

  if (!response.ok) {
    if (response.status === 401 && useAuth && authToken) {
      unauthorizedHandler?.();
    }

    throw new ApiError(
      response.status,
      extractErrorMessage(data, response.status),
    );
  }

  return data as T;
}

/**
 * O backend grava datas em UTC sem fuso ("2026-11-21T16:58:38").
 * Sem o sufixo "Z", o JavaScript as interpretaria como horário local.
 */
export function parseApiDate(value: string) {
  return new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
}
