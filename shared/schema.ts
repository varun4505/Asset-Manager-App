import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("customer").notNull(),
});

export const riders = pgTable("riders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  status: text("status").notNull(), // 'available', 'busy', 'offline'
  zone: text("zone"),
  rating: real("rating").default(5.0),
  lat: real("lat"),
  lng: real("lng"),
});

export const zones = pgTable("zones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  surgeMultiplier: real("surge_multiplier").default(1.0).notNull(),
  surgeActive: boolean("surge_active").default(false).notNull(),
  perKmRate: real("per_km_rate").default(10).notNull(),
  minDeliveryFee: real("min_delivery_fee").default(30).notNull(),
  color: text("color").notNull(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: text("customer_id").notNull(),
  storeName: text("store_name").notNull(),
  status: text("status").notNull(), // pending, confirmed, preparing, rider_assigned, picked_up, out_for_delivery, delivered, cancelled
  total: real("total").notNull(),
  items: jsonb("items").notNull(), // JSON
  pickupAddress: text("pickup_address").notNull(),
  dropAddress: text("drop_address").notNull(),
  pickupLat: real("pickup_lat").notNull(),
  pickupLng: real("pickup_lng").notNull(),
  dropLat: real("drop_lat").notNull(),
  dropLng: real("drop_lng").notNull(),
  distance: real("distance").notNull(),
  estimatedMinutes: integer("estimated_minutes").notNull(),
  assignedRiderId: text("assigned_rider_id"),
  payout: real("payout").notNull(),
  surge: real("surge"),
  zone: text("zone").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true, role: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const insertRiderSchema = createInsertSchema(riders).omit({ id: true });
export type InsertRider = z.infer<typeof insertRiderSchema>;
export type Rider = typeof riders.$inferSelect;

export const insertZoneSchema = createInsertSchema(zones).omit({ id: true });
export type InsertZone = z.infer<typeof insertZoneSchema>;
export type Zone = typeof zones.$inferSelect;

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
