import { 
  type User, type InsertUser,
  type Rider, type InsertRider,
  type Zone, type InsertZone,
  type Order, type InsertOrder
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Riders
  getRiders(): Promise<Rider[]>;
  getRider(id: string): Promise<Rider | undefined>;
  createRider(rider: InsertRider): Promise<Rider>;
  updateRider(id: string, updates: Partial<Rider>): Promise<Rider | undefined>;

  // Zones
  getZones(): Promise<Zone[]>;
  getZone(id: string): Promise<Zone | undefined>;
  createZone(zone: InsertZone): Promise<Zone>;
  updateZone(id: string, updates: Partial<Zone>): Promise<Zone | undefined>;

  // Orders
  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByCustomer(customerId: string): Promise<Order[]>;
  getOrdersByRider(riderId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private riders: Map<string, Rider>;
  private zones: Map<string, Zone>;
  private orders: Map<string, Order>;

  constructor() {
    this.users = new Map();
    this.riders = new Map();
    this.zones = new Map();
    this.orders = new Map();

    // Seed some initial zones
    this.initSeed();
  }

  private async initSeed() {
    const defaultZone = await this.createZone({
      name: "Downtown",
      surgeMultiplier: 1.0,
      surgeActive: false,
      perKmRate: 15,
      minDeliveryFee: 40,
      color: "#3B82F6",
    });

    await this.createRider({
      name: "John Doe",
      phone: "+1234567890",
      vehicleType: "Motorcycle",
      status: "available",
      zone: defaultZone.name,
      rating: 4.8,
      lat: 12.9716,
      lng: 77.5946,
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id, 
      username: insertUser.username, 
      password: insertUser.password, 
      role: insertUser.role ?? "customer"
    };
    this.users.set(id, user);
    return user;
  }

  // Riders
  async getRiders(): Promise<Rider[]> {
    return Array.from(this.riders.values());
  }

  async getRider(id: string): Promise<Rider | undefined> {
    return this.riders.get(id);
  }

  async createRider(insertRider: InsertRider): Promise<Rider> {
    const id = randomUUID();
    const rider: Rider = {
      id,
      name: insertRider.name,
      phone: insertRider.phone,
      vehicleType: insertRider.vehicleType,
      status: insertRider.status,
      zone: insertRider.zone ?? null,
      rating: insertRider.rating ?? 5.0,
      lat: insertRider.lat ?? null,
      lng: insertRider.lng ?? null,
    };
    this.riders.set(id, rider);
    return rider;
  }

  async updateRider(id: string, updates: Partial<Rider>): Promise<Rider | undefined> {
    const existing = this.riders.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.riders.set(id, updated);
    return updated;
  }

  // Zones
  async getZones(): Promise<Zone[]> {
    return Array.from(this.zones.values());
  }

  async getZone(id: string): Promise<Zone | undefined> {
    return this.zones.get(id);
  }

  async createZone(insertZone: InsertZone): Promise<Zone> {
    const id = randomUUID();
    const zone: Zone = {
      ...insertZone,
      id,
      surgeMultiplier: insertZone.surgeMultiplier ?? 1.0,
      surgeActive: insertZone.surgeActive ?? false,
      perKmRate: insertZone.perKmRate ?? 10,
      minDeliveryFee: insertZone.minDeliveryFee ?? 30,
    };
    this.zones.set(id, zone);
    return zone;
  }

  async updateZone(id: string, updates: Partial<Zone>): Promise<Zone | undefined> {
    const existing = this.zones.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.zones.set(id, updated);
    return updated;
  }

  // Orders
  async getOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(o => o.customerId === customerId);
  }

  async getOrdersByRider(riderId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(o => o.assignedRiderId === riderId);
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = randomUUID();
    const order: Order = {
      ...insertOrder,
      id,
      createdAt: new Date(),
      assignedRiderId: insertOrder.assignedRiderId ?? null,
      surge: insertOrder.surge ?? null,
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined> {
    const existing = this.orders.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.orders.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
