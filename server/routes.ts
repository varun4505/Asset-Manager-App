import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage } from "./storage";
import { insertOrderSchema, insertRiderSchema, insertZoneSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {

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
      const updated = await storage.updateZone(req.params.id, req.body);
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
    const rider = await storage.getRider(req.params.id);
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
      const updated = await storage.updateRider(req.params.id, req.body);
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
    const order = await storage.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  });

  app.get("/api/orders/customer/:customerId", async (req: Request, res: Response) => {
    const orders = await storage.getOrdersByCustomer(req.params.customerId);
    res.json(orders);
  });

  app.get("/api/orders/rider/:riderId", async (req: Request, res: Response) => {
    const orders = await storage.getOrdersByRider(req.params.riderId);
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
      const updated = await storage.updateOrder(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Order not found" });
      res.json(updated);
    } catch (e) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
