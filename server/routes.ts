import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { insertOrderSchema, insertRiderSchema, insertZoneSchema } from "@shared/schema";
import { appConfigSchema, fatigueLevelSchema } from "@shared/soft-config";
import {
  calculateFatigue,
  getBreakRecommendation,
  optimizeRouteASO,
  optimizeRouteRequestSchema,
  predictTimeToNextLevel,
  sessionInputsSchema,
} from "./soft-computing";
import { z } from "zod";

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

export function registerRoutes(app: Express): Server {
  // --- APP CONFIG ---
  app.get("/api/app-config", async (_req: Request, res: Response) => {
    const config = await storage.getAppConfig();
    res.json(config);
  });

  app.put("/api/app-config", async (req: Request, res: Response) => {
    try {
      const parsed = appConfigSchema.parse(req.body);
      const updated = await storage.setAppConfig(parsed);
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: e.errors });
      } else {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });

  // --- SOFT COMPUTING ---
  app.post("/api/soft/fatigue/evaluate", async (req: Request, res: Response) => {
    try {
      const inputs = sessionInputsSchema.parse(req.body);
      const config = await storage.getAppConfig();
      const result = calculateFatigue(inputs, config);
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: e.errors });
      } else {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });

  app.post("/api/soft/fatigue/break-recommendation", async (req: Request, res: Response) => {
    try {
      const body = z
        .object({
          score: z.number().min(0).max(100),
          level: fatigueLevelSchema,
          minutesSinceBreak: z.number().min(0).max(720),
        })
        .parse(req.body);

      const config = await storage.getAppConfig();
      const result = getBreakRecommendation(
        body.score,
        body.level,
        body.minutesSinceBreak,
        config,
      );
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: e.errors });
      } else {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });

  app.post("/api/soft/fatigue/predict", async (req: Request, res: Response) => {
    try {
      const inputs = sessionInputsSchema.parse(req.body);
      const config = await storage.getAppConfig();
      const result = predictTimeToNextLevel(inputs, config);
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: e.errors });
      } else {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });

  app.post("/api/soft/routes/optimize", async (req: Request, res: Response) => {
    try {
      const body = optimizeRouteRequestSchema.parse(req.body);
      const config = await storage.getAppConfig();

      // If the client does not provide nodes, derive them from current orders.
      if ((!body.nodes || body.nodes.length === 0) && body.deliveries) {
        const orders = await storage.getOrders();
        body.nodes = orders.slice(0, body.deliveries).map((order, idx) => ({
          id: idx + 1,
          label: `Order ${order.id.slice(0, 6)}`,
          address: order.dropAddress,
          priority: order.status === "pending" ? 1 : order.status === "out_for_delivery" ? 2 : 3,
          estimatedMinutes: order.estimatedMinutes,
          risk: Math.min(100, Math.round((order.surge ?? 1) * 15)),
          lat: order.dropLat,
          lng: order.dropLng,
        }));
      }

      const result = optimizeRouteASO(body, config);
      res.json(result);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: e.errors });
      } else {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });

  // --- ZONES ---
  app.get("/api/zones", async (_req: Request, res: Response) => {
    const zones = await storage.getZones();
    res.json(zones);
  });

  app.post("/api/zones", async (req: Request, res: Response) => {
    try {
      const zoneData = insertZoneSchema.parse(req.body);
      const zone = await storage.createZone(zoneData);
      res.status(201).json(zone);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: e.errors });
      } else {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });

  app.put("/api/zones/:id", async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateZone(getParam(req.params.id), req.body);
      if (!updated) return res.status(404).json({ error: "Zone not found" });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // --- RIDERS ---
  app.get("/api/riders", async (_req: Request, res: Response) => {
    const riders = await storage.getRiders();
    res.json(riders);
  });

  app.get("/api/riders/:id", async (req: Request, res: Response) => {
    const rider = await storage.getRider(getParam(req.params.id));
    if (!rider) return res.status(404).json({ error: "Rider not found" });
    res.json(rider);
  });

  app.post("/api/riders", async (req: Request, res: Response) => {
    try {
      const riderData = insertRiderSchema.parse(req.body);
      const rider = await storage.createRider(riderData);
      res.status(201).json(rider);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: e.errors });
      } else {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });

  app.put("/api/riders/:id", async (req: Request, res: Response) => {
    try {
      const updated = await storage.updateRider(getParam(req.params.id), req.body);
      if (!updated) return res.status(404).json({ error: "Rider not found" });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // --- ORDERS ---
  app.get("/api/orders", async (_req: Request, res: Response) => {
    const orders = await storage.getOrders();
    res.json(orders);
  });

  app.get("/api/orders/:id", async (req: Request, res: Response) => {
    const order = await storage.getOrder(getParam(req.params.id));
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  });

  app.get("/api/orders/customer/:customerId", async (req: Request, res: Response) => {
    const orders = await storage.getOrdersByCustomer(getParam(req.params.customerId));
    res.json(orders);
  });

  app.get("/api/orders/rider/:riderId", async (req: Request, res: Response) => {
    const orders = await storage.getOrdersByRider(getParam(req.params.riderId));
    res.json(orders);
  });

  app.post("/api/orders", async (req: Request, res: Response) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      res.status(201).json(order);
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: e.errors });
        console.error("Zod Validation Error on Create Order:", e.errors);
      } else {
        console.error("Internal Server Error on Create Order:", e);
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });

  app.put("/api/orders/:id", async (req: Request, res: Response) => {
    try {
      // Partially update an order
      const updated = await storage.updateOrder(getParam(req.params.id), req.body);
      if (!updated) return res.status(404).json({ error: "Order not found" });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
