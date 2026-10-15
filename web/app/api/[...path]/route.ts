import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/api-key";

// A route handler (rather than next.config.ts rewrites) because rewrites
// can't attach a header to the proxied request — and the shared API key
// must never reach the browser, only travel server-to-server.
const API_URL = (process.env.API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

// On Vercel (VERCEL=1) the API runs on another host and there is no shared
// data/.api-key file, so both must be configured explicitly — fail with a
// readable error instead of an opaque fetch failure to localhost.
const missingConfig = process.env.VERCEL
  ? ["API_URL", "API_KEY"].filter((name) => !process.env[name])
  : [];

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  if (missingConfig.length > 0) {
    return NextResponse.json(
      { error: `web is missing environment variables: ${missingConfig.join(", ")}` },
      { status: 500 }
    );
  }

  const url = `${API_URL}/api/${path.join("/")}${req.nextUrl.search}`;
  const apiKey = getApiKey();

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (apiKey) headers.set("x-api-key", apiKey);
  // Relayed, not fabricated: only meaningful (and only trusted by the API)
  // when TRUST_PROXY=1 is set there — see server/src/index.ts.
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  const hasBody = req.method !== "GET" && req.method !== "HEAD" && req.method !== "DELETE";

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.text() : undefined,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "API server unreachable" }, { status: 502 });
  }

  const body = upstream.status === 204 ? null : await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxy(req, (await ctx.params).path);
}
