import { ApiError, calculate } from './calculatorClient';

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected the promise to reject');
}

describe('calculate', () => {
  describe('success', () => {
    it('POSTs the request as JSON and returns the body', async () => {
      const body = { operation: 'add', a: 1, b: 2, result: 3 };
      fetchMock.mockResolvedValue(jsonResponse(body));

      await expect(calculate({ operation: 'add', a: 1, b: 2 })).resolves.toEqual(body);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('/api/v1/calculate');
      expect(init?.method).toBe('POST');
      expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init?.body as string)).toEqual({ operation: 'add', a: 1, b: 2 });
    });

    it('omits b for unary operations', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ operation: 'sqrt', a: 9, result: 3 }));

      await calculate({ operation: 'sqrt', a: 9, b: undefined });

      const init = fetchMock.mock.calls[0][1];
      expect(JSON.parse(init?.body as string)).toEqual({ operation: 'sqrt', a: 9 });
    });

    it('forwards the abort signal', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ operation: 'add', a: 1, b: 2, result: 3 }));
      const controller = new AbortController();

      await calculate({ operation: 'add', a: 1, b: 2 }, controller.signal);

      expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
    });
  });

  describe('API errors', () => {
    it('throws an ApiError with the code, message and status from the error body', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code: 'DIVISION_BY_ZERO', message: 'division by zero' } }, 422),
      );

      const err = await catchError(calculate({ operation: 'divide', a: 1, b: 0 }));

      expect(err).toBeInstanceOf(ApiError);
      expect(err).toBeInstanceOf(Error);
      expect(err).toMatchObject({
        name: 'ApiError',
        code: 'DIVISION_BY_ZERO',
        message: 'division by zero',
        status: 422,
      });
    });

    it.each([
      ['no error key', { message: 'nope' }],
      ['error is null', { error: null }],
      ['error is a string', { error: 'bad' }],
      ['code is not a string', { error: { code: 400, message: 'bad' } }],
      ['message is missing', { error: { code: 'BAD' } }],
      ['body is an array', []],
      ['body is null', null],
    ])('falls back to a generic error when the body has %s', async (_case, body) => {
      fetchMock.mockResolvedValue(jsonResponse(body, 500));

      const err = await catchError(calculate({ operation: 'add', a: 1, b: 2 }));

      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({
        code: 'BAD_RESPONSE',
        message: 'Request failed with status 500.',
        status: 500,
      });
    });
  });

  describe('network errors', () => {
    it('wraps a fetch failure as a NETWORK ApiError with status 0', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

      const err = await catchError(calculate({ operation: 'add', a: 1, b: 2 }));

      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({
        code: 'NETWORK',
        message: 'Could not reach the calculator service.',
        status: 0,
      });
    });

    it('rethrows an AbortError untouched', async () => {
      const abort = new DOMException('The operation was aborted.', 'AbortError');
      fetchMock.mockRejectedValue(abort);

      const err = await catchError(calculate({ operation: 'add', a: 1, b: 2 }));

      expect(err).toBe(abort);
    });

    it('treats other DOMExceptions as network errors', async () => {
      fetchMock.mockRejectedValue(new DOMException('nope', 'NetworkError'));

      const err = await catchError(calculate({ operation: 'add', a: 1, b: 2 }));

      expect(err).toMatchObject({ code: 'NETWORK', status: 0 });
    });
  });

  describe('non-JSON responses', () => {
    it.each([
      ['a 200 with an HTML body', 200],
      ['a 502 from a proxy', 502],
    ])('throws BAD_RESPONSE for %s', async (_case, status) => {
      fetchMock.mockResolvedValue(
        new Response('<html>Bad Gateway</html>', { status, headers: { 'Content-Type': 'text/html' } }),
      );

      const err = await catchError(calculate({ operation: 'add', a: 1, b: 2 }));

      expect(err).toBeInstanceOf(ApiError);
      expect(err).toMatchObject({
        code: 'BAD_RESPONSE',
        message: 'The server sent an unexpected response.',
        status,
      });
    });

    it('throws BAD_RESPONSE for an empty body', async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      const err = await catchError(calculate({ operation: 'add', a: 1, b: 2 }));

      expect(err).toMatchObject({ code: 'BAD_RESPONSE', status: 204 });
    });
  });

  // Documents current behaviour: a 2xx body is trusted without checking its shape.
  it('returns a malformed success body as-is', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unexpected: true }));

    await expect(calculate({ operation: 'add', a: 1, b: 2 })).resolves.toEqual({ unexpected: true });
  });
});

describe('base URL', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('prefixes the path with VITE_API_BASE_URL when set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://api.example.test');
    vi.resetModules();
    const client = await import('./calculatorClient');
    fetchMock.mockResolvedValue(jsonResponse({ operation: 'add', a: 1, b: 2, result: 3 }));

    await client.calculate({ operation: 'add', a: 1, b: 2 });

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.example.test/api/v1/calculate');
  });
});
