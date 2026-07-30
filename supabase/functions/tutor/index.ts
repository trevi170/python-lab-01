const allowedOrigins = new Set([
  "https://python-lab.ddns.net",
  "https://trevi170.github.io",
]);

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin)
    ? origin
    : "https://python-lab.ddns.net";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

export default {
  async fetch(req: Request) {
    const origin = req.headers.get("origin");
    const headers = corsHeaders(origin);

    if (req.method === "OPTIONS") {
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers },
      );
    }

    if (origin && !allowedOrigins.has(origin)) {
      return new Response(
        JSON.stringify({ error: "Origin not allowed" }),
        { status: 403, headers },
      );
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Tutor service is not configured" }),
        { status: 503, headers },
      );
    }

    try {
      const body = await req.json();
      if (
        typeof body.system !== "string" ||
        !Array.isArray(body.messages) ||
        body.messages.length === 0
      ) {
        return new Response(
          JSON.stringify({ error: "Invalid tutor request" }),
          { status: 400, headers },
        );
      }

      const messages = body.messages.slice(-6).map(
        (message: { role?: unknown; content?: unknown }) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: String(message.content ?? "").slice(0, 6000),
        }),
      );

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          system: body.system.slice(0, 4000),
          messages,
        }),
      });

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers,
      });
    } catch (error) {
      console.error("Tutor function error", error);
      return new Response(
        JSON.stringify({ error: "Tutor request failed" }),
        { status: 500, headers },
      );
    }
  },
};
