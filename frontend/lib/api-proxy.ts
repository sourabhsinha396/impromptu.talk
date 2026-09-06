const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8009";

/* The browser only knows the frontend origin. Keeping this hop explicit
   preserves both the session it sends and the session the backend opens. */
export function forwardApiRequest(request: Request, path: string[]) {
  const target = new URL(`/api/${path.join("/")}`, BACKEND_ORIGIN);
  target.search = new URL(request.url).search;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : request.body;
  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers: new Headers(request.headers),
    body,
    redirect: "manual",
    ...(body ? { duplex: "half" } : {}),
  };
  return fetch(new Request(target, init));
}
