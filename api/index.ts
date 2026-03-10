import { z } from "zod";
import { storage } from "../server/storage";
import {
  calculateFatigue,
  getBreakRecommendation,
  optimizeRouteASO,
  optimizeRouteRequestSchema,
  predictTimeToNextLevel,
  sessionInputsSchema,
} from "../server/soft-computing";
import {
  insertOrderSchema,
  insertRiderSchema,
  insertZoneSchema,
} from "../shared/schema";
import {
  appConfigSchema,
  fatigueLevelSchema,
} from "../shared/soft-config";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: corsHeaders,
  });
}

function html(markup: string, status = 200): Response {
  return new Response(markup, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function normalizeRoute(url: URL): string {
  const rewrittenPath = url.searchParams.get("path");

  if (rewrittenPath === "__root__") {
    return "/";
  }

  if (rewrittenPath !== null) {
    const trimmed = rewrittenPath.replace(/^\/+|\/+$/g, "");
    return trimmed ? `/api/${trimmed}` : "/api";
  }

  return url.pathname;
}

function getPathSegments(route: string): string[] {
  return route.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

async function readJson(request: Request): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength === "0") {
    return undefined;
  }

  const text = await request.text();
  if (!text.trim()) {
    return undefined;
  }

  return JSON.parse(text);
}

function zodErrorResponse(error: z.ZodError): Response {
  return json({ error: error.errors }, 400);
}

function landingPage(baseUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SafeRoute AI API</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f4f6f8; color: #10212b; }
      main { max-width: 760px; margin: 0 auto; padding: 48px 20px; }
      .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 8px 24px rgba(16, 33, 43, 0.08); }
      code { background: #edf2f7; padding: 2px 6px; border-radius: 6px; }
      a { color: #0f766e; }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <h1>SafeRoute AI API</h1>
        <p>This deployment is serving the backend API.</p>
        <p>Health check: <a href="${baseUrl}/api/app-config">${baseUrl}/api/app-config</a></p>
        <p>Soft computing routes are available under <code>/api/soft/*</code>.</p>
      </div>
    </main>
  </body>
</html>`;
}

async function handleAppConfig(method: string, body: unknown): Promise<Response> {
  if (method === "GET") {
    return json(await storage.getAppConfig());
  }

  if (method === "PUT") {
    const parsed = appConfigSchema.parse(body);
    return json(await storage.setAppConfig(parsed));
  }

  return json({ error: "Method Not Allowed" }, 405);
}

async function handleSoftComputing(
  method: string,
  segments: string[],
  body: unknown,
): Promise<Response> {
  if (method !== "POST") {
    return json({ error: "Method Not Allowed" }, 405);
  }

  const config = await storage.getAppConfig();
  const [domain, action] = segments;

  if (domain === "fatigue" && action === "evaluate") {
    const inputs = sessionInputsSchema.parse(body);
    return json(calculateFatigue(inputs, config));
  }

  if (domain === "fatigue" && action === "break-recommendation") {
    const parsed = z
      .object({
        score: z.number().min(0).max(100),
        level: fatigueLevelSchema,
        minutesSinceBreak: z.number().min(0).max(720),
      })
      .parse(body);

    return json(
      getBreakRecommendation(
        parsed.score,
        parsed.level,
        parsed.minutesSinceBreak,
        config,
      ),
    );
  }

  if (domain === "fatigue" && action === "predict") {
    const inputs = sessionInputsSchema.parse(body);
    return json(predictTimeToNextLevel(inputs, config));
  }

  if (domain === "routes" && action === "optimize") {
    const parsed = optimizeRouteRequestSchema.parse(body);

    if ((!parsed.nodes || parsed.nodes.length === 0) && parsed.deliveries) {
      const orders = await storage.getOrders();
      parsed.nodes = orders.slice(0, parsed.deliveries).map((order, index) => ({
        id: index + 1,
        label: `Order ${order.id.slice(0, 6)}`,
        address: order.dropAddress,
        priority:
          order.status === "pending"
            ? 1
            : order.status === "out_for_delivery"
              ? 2
              : 3,
        estimatedMinutes: order.estimatedMinutes,
        risk: Math.min(100, Math.round((order.surge ?? 1) * 15)),
        lat: order.dropLat,
        lng: order.dropLng,
      }));
    }

    return json(optimizeRouteASO(parsed, config));
  }

  return json({ error: "Not Found" }, 404);
}

async function handleZones(
  method: string,
  segments: string[],
  body: unknown,
): Promise<Response> {
  if (segments.length === 0) {
    if (method === "GET") {
      return json(await storage.getZones());
    }
    if (method === "POST") {
      const parsed = insertZoneSchema.parse(body);
      return json(await storage.createZone(parsed), 201);
    }
  }

  if (segments.length === 1 && method === "PUT") {
    const updated = await storage.updateZone(segments[0]!, body as Record<string, unknown>);
    return updated ? json(updated) : json({ error: "Zone not found" }, 404);
  }

  return json({ error: "Not Found" }, 404);
}

async function handleRiders(
  method: string,
  segments: string[],
  body: unknown,
): Promise<Response> {
  if (segments.length === 0) {
    if (method === "GET") {
      return json(await storage.getRiders());
    }
    if (method === "POST") {
      const parsed = insertRiderSchema.parse(body);
      return json(await storage.createRider(parsed), 201);
    }
  }

  if (segments.length === 1) {
    if (method === "GET") {
      const rider = await storage.getRider(segments[0]!);
      return rider ? json(rider) : json({ error: "Rider not found" }, 404);
    }
    if (method === "PUT") {
      const updated = await storage.updateRider(segments[0]!, body as Record<string, unknown>);
      return updated ? json(updated) : json({ error: "Rider not found" }, 404);
    }
  }

  return json({ error: "Not Found" }, 404);
}

async function handleOrders(
  method: string,
  segments: string[],
  body: unknown,
): Promise<Response> {
  if (segments.length === 0) {
    if (method === "GET") {
      return json(await storage.getOrders());
    }
    if (method === "POST") {
      const parsed = insertOrderSchema.parse(body);
      return json(await storage.createOrder(parsed), 201);
    }
  }

  if (segments[0] === "customer" && segments[1] && method === "GET") {
    return json(await storage.getOrdersByCustomer(segments[1]));
  }

  if (segments[0] === "rider" && segments[1] && method === "GET") {
    return json(await storage.getOrdersByRider(segments[1]));
  }

  if (segments.length === 1) {
    if (method === "GET") {
      const order = await storage.getOrder(segments[0]!);
      return order ? json(order) : json({ error: "Order not found" }, 404);
    }
    if (method === "PUT") {
      const updated = await storage.updateOrder(segments[0]!, body as Record<string, unknown>);
      return updated ? json(updated) : json({ error: "Order not found" }, 404);
    }
  }

  return json({ error: "Not Found" }, 404);
}

async function routeRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const route = normalizeRoute(url);
  const segments = getPathSegments(route);
  const body = await readJson(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (route === "/") {
    return html(landingPage(url.origin));
  }

  if (route === "/api" && request.method === "GET") {
    return json({
      name: "SafeRoute AI API",
      endpoints: [
        "/api/app-config",
        "/api/soft/fatigue/evaluate",
        "/api/soft/fatigue/break-recommendation",
        "/api/soft/fatigue/predict",
        "/api/soft/routes/optimize",
      ],
    });
  }

  if (segments[0] !== "api") {
    return json({ error: "Not Found" }, 404);
  }

  try {
    if (segments[1] === "app-config" && segments.length === 2) {
      return await handleAppConfig(request.method, body);
    }

    if (segments[1] === "soft") {
      return await handleSoftComputing(request.method, segments.slice(2), body);
    }

    if (segments[1] === "zones") {
      return await handleZones(request.method, segments.slice(2), body);
    }

    if (segments[1] === "riders") {
      return await handleRiders(request.method, segments.slice(2), body);
    }

    if (segments[1] === "orders") {
      return await handleOrders(request.method, segments.slice(2), body);
    }

    return json({ error: "Not Found" }, 404);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    if (error instanceof SyntaxError) {
      return json({ error: "Invalid JSON body" }, 400);
    }

    console.error("Vercel API error:", error);
    return json({ error: "Internal Server Error" }, 500);
  }
}

export default {
  async fetch(request: Request) {
    return routeRequest(request);
  },
};
