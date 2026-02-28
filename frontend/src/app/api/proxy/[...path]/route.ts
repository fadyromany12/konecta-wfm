import { NextRequest, NextResponse } from "next/server";

// Server-side: use localhost so Node can reach the backend on Windows
const BACKEND =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000/api").replace(
    "127.0.0.1",
    "localhost"
  );

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path, "GET");
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path, "POST");
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path, "PUT");
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path, "PATCH");
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path, "DELETE");
}

async function proxy(request: NextRequest, pathSegments: string[], method: string) {
  const path = pathSegments.join("/");
  const url = `${BACKEND}/${path}${request.nextUrl.search}`;

  const contentType = request.headers.get("content-type") || "";
  const isMultipart = contentType.includes("multipart/form-data");

  const headers: Record<string, string> = {};
  if (!isMultipart) headers["Content-Type"] = "application/json";
  else if (contentType) headers["Content-Type"] = contentType;
  const auth = request.headers.get("authorization");
  if (auth) headers["Authorization"] = auth;

  let body: string | ArrayBuffer | undefined;
  if (method !== "GET") {
    try {
      body = isMultipart ? await request.arrayBuffer() : await request.text();
    } catch {
      // no body
    }
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      cache: "no-store",
    });
    const data = await res.text();
    try {
      const json = JSON.parse(data);
      return NextResponse.json(json, { status: res.status });
    } catch {
      const nextRes = new NextResponse(data, { status: res.status });
      const contentType = res.headers.get("content-type");
      const disposition = res.headers.get("content-disposition");
      if (contentType) nextRes.headers.set("Content-Type", contentType);
      if (disposition) nextRes.headers.set("Content-Disposition", disposition);
      return nextRes;
    }
  } catch (e) {
    const err = e as Error;
    console.error("Proxy error to", url, err.message);
    return NextResponse.json(
      {
        error: {
          message: `Backend unreachable: ${err.message}. Is the backend running on port 4000?`,
        },
      },
      { status: 502 }
    );
  }
}
