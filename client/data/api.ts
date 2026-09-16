export class ApiError extends Error {}

async function send({ method, path, body }: { method: string; path: string; body?: unknown }): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("could not reach Parallax");
  }
  if (!response.ok) {
    const text = await response.text();
    try {
      throw new ApiError((JSON.parse(text) as { error?: string }).error ?? response.statusText);
    } catch (failure) {
      throw failure instanceof ApiError ? failure : new ApiError("could not reach Parallax");
    }
  }
  if (response.status === 204) return null;
  return response.json();
}

export function get<T>(path: string): Promise<T> {
  return send({ method: "GET", path }) as Promise<T>;
}

export function post({ path, body }: { path: string; body: unknown }): Promise<unknown> {
  return send({ method: "POST", path, body });
}

export function put({ path, body }: { path: string; body: unknown }): Promise<unknown> {
  return send({ method: "PUT", path, body });
}

export function remove(path: string): Promise<unknown> {
  return send({ method: "DELETE", path });
}
