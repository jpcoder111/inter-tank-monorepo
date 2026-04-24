import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

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
      max_tokens: 1024,
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
