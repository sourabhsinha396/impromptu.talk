import { forwardApiRequest } from "@/lib/api-proxy";

type Context = { params: Promise<{ path: string[] }> };

async function forward(request: Request, { params }: Context) {
  return forwardApiRequest(request, (await params).path);
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
export const OPTIONS = forward;
