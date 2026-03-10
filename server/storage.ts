import {
  type User,
  type InsertUser,
  type Rider,
  type InsertRider,
  type Zone,
  type InsertZone,
  type Order,
  type InsertOrder,
} from "../shared/schema";
import { defaultAppConfig, type AppConfig } from "../shared/soft-config";
import { randomUUID } from "crypto";
import { MongoClient, type Db, type OptionalUnlessRequiredId } from "mongodb";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getRiders(): Promise<Rider[]>;
  getRider(id: string): Promise<Rider | undefined>;
  createRider(rider: InsertRider): Promise<Rider>;
  updateRider(id: string, updates: Partial<Rider>): Promise<Rider | undefined>;

  getZones(): Promise<Zone[]>;
  getZone(id: string): Promise<Zone | undefined>;
  createZone(zone: InsertZone): Promise<Zone>;
  updateZone(id: string, updates: Partial<Zone>): Promise<Zone | undefined>;

  getOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByCustomer(customerId: string): Promise<Order[]>;
  getOrdersByRider(riderId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, updates: Partial<Order>): Promise<Order | undefined>;

  getAppConfig(): Promise<AppConfig>;
  setAppConfig(config: AppConfig): Promise<AppConfig>;
}

type UserDoc = Omit<User, "id"> & { _id: string };
type RiderDoc = Omit<Rider, "id"> & { _id: string };
type ZoneDoc = Omit<Zone, "id"> & { _id: string };
type OrderDoc = Omit<Order, "id"> & { _id: string };
type AppConfigDoc = { _id: string; value: AppConfig };

const DEFAULT_DB_NAME = "saferoute_ai";
const APP_CONFIG_ID = "default";

function cloneConfig(config: AppConfig): AppConfig {
  return JSON.parse(JSON.stringify(config)) as AppConfig;
}

function parseDbName(uri: string): string {
  try {
    const parsed = new URL(uri);
    const pathname = parsed.pathname.replace(/^\//, "").trim();
    return pathname || DEFAULT_DB_NAME;
  } catch {
    return DEFAULT_DB_NAME;
  }
}

function sanitizeUpdate<T extends { id?: string }>(updates: Partial<T>) {
  return Object.fromEntries(
    Object.entries(updates).filter(([key, value]) => key !== "id" && value !== undefined),
  );
}

function toUser(doc: UserDoc | null): User | undefined {
  if (!doc) return undefined;
  return {
    id: doc._id,
    username: doc.username,
    password: doc.password,
    role: doc.role,
  };
}

function toRider(doc: RiderDoc | null): Rider | undefined {
  if (!doc) return undefined;
  return {
    id: doc._id,
    name: doc.name,
    phone: doc.phone,
    vehicleType: doc.vehicleType,
    status: doc.status,
    zone: doc.zone ?? null,
    rating: doc.rating ?? 5,
    lat: doc.lat ?? null,
    lng: doc.lng ?? null,
  };
}

function toZone(doc: ZoneDoc | null): Zone | undefined {
  if (!doc) return undefined;
  return {
    id: doc._id,
    name: doc.name,
    surgeMultiplier: doc.surgeMultiplier ?? 1,
    surgeActive: doc.surgeActive ?? false,
    perKmRate: doc.perKmRate ?? 10,
    minDeliveryFee: doc.minDeliveryFee ?? 30,
    color: doc.color,
  };
}

function toOrder(doc: OrderDoc | null): Order | undefined {
  if (!doc) return undefined;
  return {
    id: doc._id,
    customerId: doc.customerId,
    storeName: doc.storeName,
    status: doc.status,
    total: doc.total,
    items: doc.items,
    pickupAddress: doc.pickupAddress,
    dropAddress: doc.dropAddress,
    pickupLat: doc.pickupLat,
    pickupLng: doc.pickupLng,
    dropLat: doc.dropLat,
    dropLng: doc.dropLng,
    distance: doc.distance,
    estimatedMinutes: doc.estimatedMinutes,
    assignedRiderId: doc.assignedRiderId ?? null,
    payout: doc.payout,
    surge: doc.surge ?? null,
    zone: doc.zone,
    createdAt: new Date(doc.createdAt),
  };
}

export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private riders = new Map<string, Rider>();
  private zones = new Map<string, Zone>();
  private orders = new Map<string, Order>();
  private appConfig = cloneConfig(defaultAppConfig);

  constructor() {
    void this.seedDefaults();
  }

  private async seedDefaults() {
    if (this.zones.size === 0) {
      const defaultZone = await this.createZone({
        name: "Downtown",
        surgeMultiplier: 1,
        surgeActive: false,
        perKmRate: 15,
        minDeliveryFee: 40,
        color: "#3B82F6",
      });

      if (this.riders.size === 0) {
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
    }
  }

  async getUser(id: string) {
    return this.users.get(id);
  }

  async getUserByUsername(username: string) {
    return Array.from(this.users.values()).find((user) => user.username === username);
  }

  async createUser(insertUser: InsertUser) {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      role: insertUser.role ?? "customer",
    };
    this.users.set(id, user);
    return user;
  }

  async getRiders() {
    return Array.from(this.riders.values());
  }

  async getRider(id: string) {
    return this.riders.get(id);
  }

  async createRider(insertRider: InsertRider) {
    const id = randomUUID();
    const rider: Rider = {
      id,
      name: insertRider.name,
      phone: insertRider.phone,
      vehicleType: insertRider.vehicleType,
      status: insertRider.status,
      zone: insertRider.zone ?? null,
      rating: insertRider.rating ?? 5,
      lat: insertRider.lat ?? null,
      lng: insertRider.lng ?? null,
    };
    this.riders.set(id, rider);
    return rider;
  }

  async updateRider(id: string, updates: Partial<Rider>) {
    const existing = this.riders.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...sanitizeUpdate(updates) };
    this.riders.set(id, updated);
    return updated;
  }

  async getZones() {
    return Array.from(this.zones.values());
  }

  async getZone(id: string) {
    return this.zones.get(id);
  }

  async createZone(insertZone: InsertZone) {
    const id = randomUUID();
    const zone: Zone = {
      id,
      name: insertZone.name,
      surgeMultiplier: insertZone.surgeMultiplier ?? 1,
      surgeActive: insertZone.surgeActive ?? false,
      perKmRate: insertZone.perKmRate ?? 10,
      minDeliveryFee: insertZone.minDeliveryFee ?? 30,
      color: insertZone.color,
    };
    this.zones.set(id, zone);
    return zone;
  }

  async updateZone(id: string, updates: Partial<Zone>) {
    const existing = this.zones.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...sanitizeUpdate(updates) };
    this.zones.set(id, updated);
    return updated;
  }

  async getOrders() {
    return Array.from(this.orders.values());
  }

  async getOrder(id: string) {
    return this.orders.get(id);
  }

  async getOrdersByCustomer(customerId: string) {
    return Array.from(this.orders.values()).filter((order) => order.customerId === customerId);
  }

  async getOrdersByRider(riderId: string) {
    return Array.from(this.orders.values()).filter((order) => order.assignedRiderId === riderId);
  }

  async createOrder(insertOrder: InsertOrder) {
    const id = randomUUID();
    const order: Order = {
      id,
      customerId: insertOrder.customerId,
      storeName: insertOrder.storeName,
      status: insertOrder.status,
      total: insertOrder.total,
      items: insertOrder.items,
      pickupAddress: insertOrder.pickupAddress,
      dropAddress: insertOrder.dropAddress,
      pickupLat: insertOrder.pickupLat,
      pickupLng: insertOrder.pickupLng,
      dropLat: insertOrder.dropLat,
      dropLng: insertOrder.dropLng,
      distance: insertOrder.distance,
      estimatedMinutes: insertOrder.estimatedMinutes,
      assignedRiderId: insertOrder.assignedRiderId ?? null,
      payout: insertOrder.payout,
      surge: insertOrder.surge ?? null,
      zone: insertOrder.zone,
      createdAt: new Date(),
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: string, updates: Partial<Order>) {
    const existing = this.orders.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...sanitizeUpdate(updates) };
    this.orders.set(id, updated);
    return updated;
  }

  async getAppConfig() {
    return cloneConfig(this.appConfig);
  }

  async setAppConfig(config: AppConfig) {
    this.appConfig = cloneConfig(config);
    return this.getAppConfig();
  }
}

class MongoStorage implements IStorage {
  private client: MongoClient;
  private dbName: string;
  private dbPromise: Promise<Db> | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor(uri: string, dbName?: string) {
    this.client = new MongoClient(uri);
    this.dbName = dbName || parseDbName(uri);
  }

  private async getDb() {
    if (!this.dbPromise) {
      this.dbPromise = this.client.connect().then((client) => client.db(this.dbName));
    }
    return this.dbPromise;
  }

  private async getCollections() {
    const db = await this.getDb();
    return {
      users: db.collection<UserDoc>("users"),
      riders: db.collection<RiderDoc>("riders"),
      zones: db.collection<ZoneDoc>("zones"),
      orders: db.collection<OrderDoc>("orders"),
      appConfig: db.collection<AppConfigDoc>("app_config"),
    };
  }

  private async ensureInitialized() {
    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        const collections = await this.getCollections();

        await Promise.all([
          collections.users.createIndex({ username: 1 }, { unique: true }),
          collections.orders.createIndex({ customerId: 1 }),
          collections.orders.createIndex({ assignedRiderId: 1 }),
          collections.riders.createIndex({ zone: 1 }),
          collections.zones.createIndex({ name: 1 }),
        ]);

        await this.seedDefaults(collections);
      })();
    }

    await this.initializationPromise;
  }

  private async seedDefaults(collections: Awaited<ReturnType<MongoStorage["getCollections"]>>) {
    const zoneCount = await collections.zones.countDocuments();
    if (zoneCount === 0) {
      const zoneId = randomUUID();
      const zoneDoc: ZoneDoc = {
        _id: zoneId,
        name: "Downtown",
        surgeMultiplier: 1,
        surgeActive: false,
        perKmRate: 15,
        minDeliveryFee: 40,
        color: "#3B82F6",
      };
      await collections.zones.insertOne(zoneDoc);
    }

    const riderCount = await collections.riders.countDocuments();
    if (riderCount === 0) {
      const defaultZone = await collections.zones.findOne({}, { sort: { name: 1 } });
      const riderDoc: RiderDoc = {
        _id: randomUUID(),
        name: "John Doe",
        phone: "+1234567890",
        vehicleType: "Motorcycle",
        status: "available",
        zone: defaultZone?.name ?? null,
        rating: 4.8,
        lat: 12.9716,
        lng: 77.5946,
      };
      await collections.riders.insertOne(riderDoc);
    }

    const configDoc = await collections.appConfig.findOne({ _id: APP_CONFIG_ID });
    if (!configDoc) {
      await collections.appConfig.insertOne({
        _id: APP_CONFIG_ID,
        value: cloneConfig(defaultAppConfig),
      });
    }
  }

  async getUser(id: string) {
    await this.ensureInitialized();
    const { users } = await this.getCollections();
    return toUser(await users.findOne({ _id: id }));
  }

  async getUserByUsername(username: string) {
    await this.ensureInitialized();
    const { users } = await this.getCollections();
    return toUser(await users.findOne({ username }));
  }

  async createUser(insertUser: InsertUser) {
    await this.ensureInitialized();
    const { users } = await this.getCollections();
    const userDoc: UserDoc = {
      _id: randomUUID(),
      username: insertUser.username,
      password: insertUser.password,
      role: insertUser.role ?? "customer",
    };
    await users.insertOne(userDoc as OptionalUnlessRequiredId<UserDoc>);
    return toUser(userDoc)!;
  }

  async getRiders() {
    await this.ensureInitialized();
    const { riders } = await this.getCollections();
    const docs = await riders.find({}).toArray();
    return docs.map((doc) => toRider(doc)!).filter(Boolean);
  }

  async getRider(id: string) {
    await this.ensureInitialized();
    const { riders } = await this.getCollections();
    return toRider(await riders.findOne({ _id: id }));
  }

  async createRider(insertRider: InsertRider) {
    await this.ensureInitialized();
    const { riders } = await this.getCollections();
    const riderDoc: RiderDoc = {
      _id: randomUUID(),
      name: insertRider.name,
      phone: insertRider.phone,
      vehicleType: insertRider.vehicleType,
      status: insertRider.status,
      zone: insertRider.zone ?? null,
      rating: insertRider.rating ?? 5,
      lat: insertRider.lat ?? null,
      lng: insertRider.lng ?? null,
    };
    await riders.insertOne(riderDoc as OptionalUnlessRequiredId<RiderDoc>);
    return toRider(riderDoc)!;
  }

  async updateRider(id: string, updates: Partial<Rider>) {
    await this.ensureInitialized();
    const { riders } = await this.getCollections();
    const update = sanitizeUpdate(updates);
    if (Object.keys(update).length > 0) {
      await riders.updateOne({ _id: id }, { $set: update });
    }
    return this.getRider(id);
  }

  async getZones() {
    await this.ensureInitialized();
    const { zones } = await this.getCollections();
    const docs = await zones.find({}).toArray();
    return docs.map((doc) => toZone(doc)!).filter(Boolean);
  }

  async getZone(id: string) {
    await this.ensureInitialized();
    const { zones } = await this.getCollections();
    return toZone(await zones.findOne({ _id: id }));
  }

  async createZone(insertZone: InsertZone) {
    await this.ensureInitialized();
    const { zones } = await this.getCollections();
    const zoneDoc: ZoneDoc = {
      _id: randomUUID(),
      name: insertZone.name,
      surgeMultiplier: insertZone.surgeMultiplier ?? 1,
      surgeActive: insertZone.surgeActive ?? false,
      perKmRate: insertZone.perKmRate ?? 10,
      minDeliveryFee: insertZone.minDeliveryFee ?? 30,
      color: insertZone.color,
    };
    await zones.insertOne(zoneDoc as OptionalUnlessRequiredId<ZoneDoc>);
    return toZone(zoneDoc)!;
  }

  async updateZone(id: string, updates: Partial<Zone>) {
    await this.ensureInitialized();
    const { zones } = await this.getCollections();
    const update = sanitizeUpdate(updates);
    if (Object.keys(update).length > 0) {
      await zones.updateOne({ _id: id }, { $set: update });
    }
    return this.getZone(id);
  }

  async getOrders() {
    await this.ensureInitialized();
    const { orders } = await this.getCollections();
    const docs = await orders.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map((doc) => toOrder(doc)!).filter(Boolean);
  }

  async getOrder(id: string) {
    await this.ensureInitialized();
    const { orders } = await this.getCollections();
    return toOrder(await orders.findOne({ _id: id }));
  }

  async getOrdersByCustomer(customerId: string) {
    await this.ensureInitialized();
    const { orders } = await this.getCollections();
    const docs = await orders.find({ customerId }).sort({ createdAt: -1 }).toArray();
    return docs.map((doc) => toOrder(doc)!).filter(Boolean);
  }

  async getOrdersByRider(riderId: string) {
    await this.ensureInitialized();
    const { orders } = await this.getCollections();
    const docs = await orders.find({ assignedRiderId: riderId }).sort({ createdAt: -1 }).toArray();
    return docs.map((doc) => toOrder(doc)!).filter(Boolean);
  }

  async createOrder(insertOrder: InsertOrder) {
    await this.ensureInitialized();
    const { orders } = await this.getCollections();
    const orderDoc: OrderDoc = {
      _id: randomUUID(),
      customerId: insertOrder.customerId,
      storeName: insertOrder.storeName,
      status: insertOrder.status,
      total: insertOrder.total,
      items: insertOrder.items,
      pickupAddress: insertOrder.pickupAddress,
      dropAddress: insertOrder.dropAddress,
      pickupLat: insertOrder.pickupLat,
      pickupLng: insertOrder.pickupLng,
      dropLat: insertOrder.dropLat,
      dropLng: insertOrder.dropLng,
      distance: insertOrder.distance,
      estimatedMinutes: insertOrder.estimatedMinutes,
      assignedRiderId: insertOrder.assignedRiderId ?? null,
      payout: insertOrder.payout,
      surge: insertOrder.surge ?? null,
      zone: insertOrder.zone,
      createdAt: new Date(),
    };
    await orders.insertOne(orderDoc as OptionalUnlessRequiredId<OrderDoc>);
    return toOrder(orderDoc)!;
  }

  async updateOrder(id: string, updates: Partial<Order>) {
    await this.ensureInitialized();
    const { orders } = await this.getCollections();
    const update = sanitizeUpdate(updates);
    if (Object.keys(update).length > 0) {
      await orders.updateOne({ _id: id }, { $set: update });
    }
    return this.getOrder(id);
  }

  async getAppConfig() {
    await this.ensureInitialized();
    const { appConfig } = await this.getCollections();
    const doc = await appConfig.findOne({ _id: APP_CONFIG_ID });
    if (!doc) {
      const fallback = cloneConfig(defaultAppConfig);
      await appConfig.insertOne({ _id: APP_CONFIG_ID, value: fallback });
      return fallback;
    }
    return cloneConfig(doc.value);
  }

  async setAppConfig(config: AppConfig) {
    await this.ensureInitialized();
    const { appConfig } = await this.getCollections();
    const nextConfig = cloneConfig(config);
    await appConfig.updateOne(
      { _id: APP_CONFIG_ID },
      { $set: { value: nextConfig } },
      { upsert: true },
    );
    return nextConfig;
  }
}

const mongoUri = process.env.MONGODB_URI?.trim();
const mongoDbName = process.env.MONGODB_DB_NAME?.trim();

export const storageMode = mongoUri ? "mongodb" : "memory";
export const storage: IStorage = mongoUri
  ? new MongoStorage(mongoUri, mongoDbName)
  : new MemStorage();

if (storageMode === "memory") {
  console.warn("[storage] MONGODB_URI not set. Falling back to in-memory storage.");
}
