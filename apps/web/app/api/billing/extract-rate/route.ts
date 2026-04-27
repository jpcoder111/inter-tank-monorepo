import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
// Vercel Hobby caps serverless functions at 60s. Large Excel extractions can
// take ~30-40s end-to-end (CSV upload + Claude generation), so we explicitly
// claim the full window rather than letting the function default to 10s.
export const maxDuration = 60;

type Base64Source = { type: "base64"; media_type: string; data: string };
type UrlSource = { type: "url"; url: string };

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: Base64Source | UrlSource }
  | { type: "document"; source: Base64Source | UrlSource };

type RequestBody = {
  system: string;
  content: string | ContentBlock[];
};

const VISION_MODEL = "claude-sonnet-4-6";
const TEXT_MODEL = "claude-haiku-4-5-20251001";

function hasMedia(content: string | ContentBlock[]): boolean {
  if (typeof content === "string") return false;
  return content.some((c) => c.type === "image" || c.type === "document");
}

async function callAnthropicDirect(
  apiKey: string,
  system: string,
  content: string | ContentBlock[]
) {
  const model = hasMedia(content) ? VISION_MODEL : TEXT_MODEL;
  const userContent: ContentBlock[] =
    typeof content === "string" ? [{ type: "text", text: content }] : content;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 24576,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: `Anthropic API error ${response.status}`, detail },
      { status: 502 }
    );
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text =
    data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

  return NextResponse.json({ text, model });
}

async function callBackendProxy(
  backendUrl: string,
  body: RequestBody
) {
  const session = await getSession();
  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Not authenticated — cannot proxy to backend" },
      { status: 401 }
    );
  }

  const response = await fetch(`${backendUrl}/ai/extract-rate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: `Backend proxy error ${response.status}`, detail },
      { status: 502 }
    );
  }

  const data = (await response.json()) as { text?: string; model?: string };
  return NextResponse.json({
    text: data.text ?? "",
    model: data.model ?? "unknown",
  });
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { system, content } = body;
  if (!system || !content) {
    return NextResponse.json(
      { error: "Missing 'system' or 'content'" },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return callAnthropicDirect(apiKey, system, content);
  }

  const backendUrl =
    process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;
  if (backendUrl) {
    return callBackendProxy(backendUrl, body);
  }

  return NextResponse.json(
    {
      error:
        "Missing ANTHROPIC_API_KEY (frontend) and BACKEND_URL (proxy fallback). Configure one of them.",
    },
    { status: 500 }
  );
}
