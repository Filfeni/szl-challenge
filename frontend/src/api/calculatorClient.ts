import type { OperationName } from '../lib/operations';

export interface CalculateRequest {
  operation: OperationName;
  a: number;
  b?: number;
}

export interface CalculateResponse {
  operation: OperationName;
  a: number;
  b?: number;
  result: number;
}

interface ErrorResponse {
  error: { code: string; message: string };
}

// Just one error type for everything that can go wrong
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function calculate(
  req: CalculateRequest,
  signal?: AbortSignal,
): Promise<CalculateResponse> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/v1/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError('NETWORK', 'Could not reach the calculator service.', 0);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError('BAD_RESPONSE', 'The server sent an unexpected response.', res.status);
  }

  if (!res.ok) {
    if (isErrorResponse(body)) {
      throw new ApiError(body.error.code, body.error.message, res.status);
    }
    throw new ApiError('BAD_RESPONSE', `Request failed with status ${res.status}.`, res.status);
  }
  return body as CalculateResponse;
}

function isErrorResponse(body: unknown): body is ErrorResponse {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false;
  const err = (body as ErrorResponse).error;
  return typeof err?.code === 'string' && typeof err?.message === 'string';
}
