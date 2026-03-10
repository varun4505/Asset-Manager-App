import { apiRequest } from "@/lib/query-client";
import type { AppConfig } from "@shared/soft-config";
import Colors from "@/constants/colors";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "rider_assigned",
  "picked_up",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export const RIDER_STATUSES = ["available", "busy", "offline"] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type RiderStatus = (typeof RIDER_STATUSES)[number];

export interface OrderItem {
  name: string;
  quantity: number;
}

export interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  status: RiderStatus;
  zone: string | null;
  rating: number | null;
  lat: number | null;
  lng: number | null;
}

export interface Zone {
  id: string;
  name: string;
  surgeMultiplier: number;
  surgeActive: boolean;
  perKmRate: number;
  minDeliveryFee: number;
  color: string;
}

export interface Order {
  id: string;
  customerId: string;
  storeName: string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
  pickupAddress: string;
  dropAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  distance: number;
  estimatedMinutes: number;
  assignedRiderId: string | null;
  payout: number;
  surge: number | null;
  zone: string;
  createdAt: string;
}

export interface CreateOrderInput {
  customerId: string;
  storeName: string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
  pickupAddress: string;
  dropAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  distance: number;
  estimatedMinutes: number;
  assignedRiderId?: string | null;
  payout: number;
  surge?: number | null;
  zone: string;
}

export interface CreateRiderInput {
  name: string;
  phone: string;
  vehicleType: string;
  status: RiderStatus;
  zone?: string | null;
  rating?: number | null;
  lat?: number | null;
  lng?: number | null;
}

export interface CreateZoneInput {
  name: string;
  surgeMultiplier?: number;
  surgeActive?: boolean;
  perKmRate?: number;
  minDeliveryFee?: number;
  color: string;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function fetchOrders(): Promise<Order[]> {
  return readJson<Order[]>(await apiRequest("GET", "/api/orders"));
}

export async function fetchCustomerOrders(customerId: string): Promise<Order[]> {
  return readJson<Order[]>(
    await apiRequest("GET", `/api/orders/customer/${customerId}`),
  );
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  return readJson<Order>(await apiRequest("POST", "/api/orders", input));
}

export async function updateOrder(
  id: string,
  updates: Partial<Order>,
): Promise<Order> {
  return readJson<Order>(await apiRequest("PUT", `/api/orders/${id}`, updates));
}

export async function fetchRiders(): Promise<Rider[]> {
  return readJson<Rider[]>(await apiRequest("GET", "/api/riders"));
}

export async function createRider(input: CreateRiderInput): Promise<Rider> {
  return readJson<Rider>(await apiRequest("POST", "/api/riders", input));
}

export async function updateRider(
  id: string,
  updates: Partial<Rider>,
): Promise<Rider> {
  return readJson<Rider>(await apiRequest("PUT", `/api/riders/${id}`, updates));
}

export async function fetchZones(): Promise<Zone[]> {
  return readJson<Zone[]>(await apiRequest("GET", "/api/zones"));
}

export async function createZone(input: CreateZoneInput): Promise<Zone> {
  return readJson<Zone>(await apiRequest("POST", "/api/zones", input));
}

export async function updateZone(
  id: string,
  updates: Partial<Zone>,
): Promise<Zone> {
  return readJson<Zone>(await apiRequest("PUT", `/api/zones/${id}`, updates));
}

export async function updateRemoteAppConfig(config: AppConfig): Promise<AppConfig> {
  return readJson<AppConfig>(await apiRequest("PUT", "/api/app-config", config));
}

export function estimateDeliveryFee(zone: Zone | undefined, distanceKm: number): number {
  if (!zone) return 0;
  const surge = zone.surgeActive ? zone.surgeMultiplier : 1;
  const variableFee = distanceKm * zone.perKmRate * surge;
  return Math.max(zone.minDeliveryFee, Math.round(variableFee));
}

export function orderStatusColor(status: OrderStatus): string {
  switch (status) {
    case "pending":
    case "confirmed":
      return Colors.caution;
    case "preparing":
    case "rider_assigned":
      return Colors.accent;
    case "picked_up":
    case "out_for_delivery":
      return Colors.safe;
    case "delivered":
      return Colors.safe;
    case "cancelled":
      return Colors.danger;
    default:
      return Colors.textMuted;
  }
}

export function riderStatusColor(status: RiderStatus): string {
  switch (status) {
    case "available":
      return Colors.safe;
    case "busy":
      return Colors.caution;
    case "offline":
      return Colors.danger;
    default:
      return Colors.textMuted;
  }
}

export function nextOrderStatus(status: OrderStatus): OrderStatus | null {
  switch (status) {
    case "pending":
      return "confirmed";
    case "confirmed":
      return "preparing";
    case "preparing":
      return "rider_assigned";
    case "rider_assigned":
      return "picked_up";
    case "picked_up":
      return "out_for_delivery";
    case "out_for_delivery":
      return "delivered";
    default:
      return null;
  }
}

export function getDemoCoordinates(zoneIndex: number, distanceKm: number) {
  const baseLat = 12.94 + zoneIndex * 0.018;
  const baseLng = 77.58 + zoneIndex * 0.013;

  return {
    pickupLat: Number(baseLat.toFixed(6)),
    pickupLng: Number(baseLng.toFixed(6)),
    dropLat: Number((baseLat + Math.max(0.003, distanceKm * 0.004)).toFixed(6)),
    dropLng: Number((baseLng + Math.max(0.003, distanceKm * 0.003)).toFixed(6)),
  };
}

export function formatMoney(value: number): string {
  return `Rs ${Math.round(value)}`;
}

