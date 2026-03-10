import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppConfig } from "@shared/soft-config";
import { defaultAppConfig } from "@shared/soft-config";
import Colors from "@/constants/colors";
import { runACO, type ACORoute, type DeliveryNode } from "@/lib/acoEngine";
import { APP_CONFIG_QUERY_KEY, useAppConfig } from "@/lib/app-config";
import {
  ORDER_STATUSES,
  RIDER_STATUSES,
  type Order,
  type OrderStatus,
  type Rider,
  type Zone,
  createRider,
  createZone,
  fetchOrders,
  fetchRiders,
  fetchZones,
  formatMoney,
  nextOrderStatus,
  orderStatusColor,
  riderStatusColor,
  updateOrder,
  updateRemoteAppConfig,
  updateRider,
  updateZone,
} from "@/lib/logistics-api";
import {
  evaluateFatigueRemote,
  getBreakRecommendationRemote,
  predictFatigueRemote,
} from "@/lib/soft-api";
import type {
  BreakRecommendation,
  FatigueResult,
  PredictionResult,
  SessionInputs,
} from "@/lib/fatigueEngine";

type AdminSection = "overview" | "orders" | "riders" | "zones" | "soft" | "config";

type ConfigDraft = {
  lowMax: string;
  mediumMax: string;
  hungerStep: string;
  lowBreak: string;
  mediumBreak: string;
  highBreak: string;
  ants: string;
  iterations: string;
  riskWeight: string;
  priorityWeight: string;
};

type ZoneDraft = {
  perKmRate: string;
  minDeliveryFee: string;
  surgeMultiplier: string;
  color: string;
  surgeActive: boolean;
};

const SECTION_ITEMS: {
  id: AdminSection;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { id: "overview", label: "Overview", icon: "grid-outline", color: Colors.accent },
  { id: "orders", label: "Orders", icon: "receipt-outline", color: Colors.safe },
  { id: "riders", label: "Riders", icon: "bicycle-outline", color: Colors.caution },
  { id: "zones", label: "Zones", icon: "map-outline", color: Colors.accent },
  { id: "soft", label: "Soft AI", icon: "pulse-outline", color: Colors.danger },
  { id: "config", label: "Config", icon: "options-outline", color: Colors.textSecondary },
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SegmentButton({
  label,
  icon,
  color,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segmentButton,
        active && { backgroundColor: `${color}18`, borderColor: `${color}60` },
      ]}
    >
      <Ionicons name={icon} size={15} color={active ? color : Colors.textMuted} />
      <Text style={[styles.segmentButtonText, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

function KpiCard({
  label,
  value,
  color,
  helper,
}: {
  label: string;
  value: string;
  color: string;
  helper: string;
}) {
  return (
    <View style={[styles.kpiCard, { borderColor: `${color}35` }]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiHelper}>{helper}</Text>
    </View>
  );
}

function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.statusChip, { backgroundColor: `${color}18`, borderColor: `${color}50` }]}>
      <Text style={[styles.statusChipText, { color }]}>{label}</Text>
    </View>
  );
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function pulseSuccess() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

async function pulseLight() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

function buildRouteNodes(orders: Order[], count: number): DeliveryNode[] {
  return orders.slice(0, Math.max(2, count)).map((order, index) => ({
    id: index + 1,
    label: order.storeName,
    address: order.dropAddress,
    priority: order.status === "pending" ? 1 : order.status === "out_for_delivery" ? 2 : 3,
    estimatedMinutes: order.estimatedMinutes,
    risk: Math.min(100, Math.round((order.surge ?? 1) * 18 + order.distance * 3)),
    lat: order.dropLat,
    lng: order.dropLng,
  }));
}

export default function AdminHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [section, setSection] = useState<AdminSection>("overview");
  const [orderStatusFilter, setOrderStatusFilter] = useState<"all" | OrderStatus>("all");
  const [orderZoneFilter, setOrderZoneFilter] = useState<string>("all");

  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [riderVehicle, setRiderVehicle] = useState("Motorcycle");
  const [riderStatus, setRiderStatus] = useState<(typeof RIDER_STATUSES)[number]>("available");
  const [riderZone, setRiderZone] = useState<string | null>(null);

  const [zoneName, setZoneName] = useState("");
  const [zoneColor, setZoneColor] = useState("#00C2FF");
  const [zonePerKmRate, setZonePerKmRate] = useState("12");
  const [zoneMinFee, setZoneMinFee] = useState("45");
  const [zoneSurgeMultiplier, setZoneSurgeMultiplier] = useState("1.4");
  const [zoneSurgeActive, setZoneSurgeActive] = useState(false);
  const [zoneDrafts, setZoneDrafts] = useState<Record<string, ZoneDraft>>({});

  const [softDrivingHours, setSoftDrivingHours] = useState("3");
  const [softDeliveries, setSoftDeliveries] = useState("6");
  const [softBreakMinutes, setSoftBreakMinutes] = useState("80");
  const [softHunger, setSoftHunger] = useState("2");
  const [softWeather, setSoftWeather] = useState<SessionInputs["weather"]>("cloudy");
  const [softTimeOfDay, setSoftTimeOfDay] = useState<SessionInputs["timeOfDay"]>("evening");
  const [softResult, setSoftResult] = useState<FatigueResult | null>(null);
  const [softPrediction, setSoftPrediction] = useState<PredictionResult | null>(null);
  const [softBreakAdvice, setSoftBreakAdvice] = useState<BreakRecommendation | null>(null);
  const [routeStopCount, setRouteStopCount] = useState("4");
  const [routeResult, setRouteResult] = useState<ACORoute | null>(null);

  const [configDraft, setConfigDraft] = useState<ConfigDraft>({
    lowMax: String(defaultAppConfig.fatigueThresholds.lowMax),
    mediumMax: String(defaultAppConfig.fatigueThresholds.mediumMax),
    hungerStep: String(defaultAppConfig.fatigueFactors.hungerStep),
    lowBreak: String(defaultAppConfig.breakPolicy.low.recommendedDurationMinutes),
    mediumBreak: String(defaultAppConfig.breakPolicy.medium.recommendedDurationMinutes),
    highBreak: String(defaultAppConfig.breakPolicy.high.recommendedDurationMinutes),
    ants: String(defaultAppConfig.aso.ants),
    iterations: String(defaultAppConfig.aso.iterations),
    riskWeight: String(defaultAppConfig.aso.riskWeight),
    priorityWeight: String(defaultAppConfig.aso.priorityWeight),
  });

  const ordersQuery = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });
  const ridersQuery = useQuery({
    queryKey: ["riders"],
    queryFn: fetchRiders,
  });
  const zonesQuery = useQuery({
    queryKey: ["zones"],
    queryFn: fetchZones,
  });
  const appConfigQuery = useAppConfig();

  const config = appConfigQuery.data ?? defaultAppConfig;
  const orders = useMemo(
    () => [...(ordersQuery.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [ordersQuery.data],
  );
  const riders = useMemo(() => ridersQuery.data ?? [], [ridersQuery.data]);
  const zones = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data]);

  useEffect(() => {
    if (!riderZone && zones.length > 0) {
      setRiderZone(zones[0].name);
    }
  }, [riderZone, zones]);

  useEffect(() => {
    if (zones.length === 0) return;
    setZoneDrafts((current) => {
      const next: Record<string, ZoneDraft> = {};
      for (const zone of zones) {
        next[zone.id] = current[zone.id] ?? {
          perKmRate: String(zone.perKmRate),
          minDeliveryFee: String(zone.minDeliveryFee),
          surgeMultiplier: String(zone.surgeMultiplier),
          color: zone.color,
          surgeActive: zone.surgeActive,
        };
      }
      return next;
    });
  }, [zones]);

  useEffect(() => {
    setConfigDraft({
      lowMax: String(config.fatigueThresholds.lowMax),
      mediumMax: String(config.fatigueThresholds.mediumMax),
      hungerStep: String(config.fatigueFactors.hungerStep),
      lowBreak: String(config.breakPolicy.low.recommendedDurationMinutes),
      mediumBreak: String(config.breakPolicy.medium.recommendedDurationMinutes),
      highBreak: String(config.breakPolicy.high.recommendedDurationMinutes),
      ants: String(config.aso.ants),
      iterations: String(config.aso.iterations),
      riskWeight: String(config.aso.riskWeight),
      priorityWeight: String(config.aso.priorityWeight),
    });
  }, [
    config.aso.ants,
    config.aso.iterations,
    config.aso.priorityWeight,
    config.aso.riskWeight,
    config.breakPolicy.high.recommendedDurationMinutes,
    config.breakPolicy.low.recommendedDurationMinutes,
    config.breakPolicy.medium.recommendedDurationMinutes,
    config.fatigueFactors.hungerStep,
    config.fatigueThresholds.lowMax,
    config.fatigueThresholds.mediumMax,
  ]);

  const createRiderMutation = useMutation({
    mutationFn: createRider,
    onSuccess: async () => {
      await pulseSuccess();
      await queryClient.invalidateQueries({ queryKey: ["riders"] });
    },
  });

  const updateRiderMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Rider> }) => updateRider(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["riders"] });
    },
  });

  const createZoneMutation = useMutation({
    mutationFn: createZone,
    onSuccess: async () => {
      await pulseSuccess();
      await queryClient.invalidateQueries({ queryKey: ["zones"] });
    },
  });

  const updateZoneMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Zone> }) => updateZone(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["zones"] });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Order> }) => updateOrder(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: updateRemoteAppConfig,
    onSuccess: async () => {
      await pulseSuccess();
      await queryClient.invalidateQueries({ queryKey: APP_CONFIG_QUERY_KEY });
    },
  });

  const fatigueMutation = useMutation({
    mutationFn: async (inputs: SessionInputs) => {
      const fatigue = await evaluateFatigueRemote(inputs);
      const [prediction, breakAdvice] = await Promise.all([
        predictFatigueRemote(inputs),
        getBreakRecommendationRemote(
          fatigue.score,
          fatigue.level,
          inputs.minutesSinceBreak,
        ),
      ]);
      return { fatigue, prediction, breakAdvice };
    },
    onSuccess: async ({ fatigue, prediction, breakAdvice }) => {
      await pulseLight();
      setSoftResult(fatigue);
      setSoftPrediction(prediction);
      setSoftBreakAdvice(breakAdvice);
    },
  });

  const routeMutation = useMutation({
    mutationFn: async () => {
      const inputCount = Math.max(2, toNumber(routeStopCount, 4));
      const nodes = buildRouteNodes(orders, inputCount);
      return runACO(inputCount, softResult?.score ?? 45, nodes);
    },
    onSuccess: async (result) => {
      await pulseLight();
      setRouteResult(result);
    },
  });

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusMatch = orderStatusFilter === "all" || order.status === orderStatusFilter;
      const zoneMatch = orderZoneFilter === "all" || order.zone === orderZoneFilter;
      return statusMatch && zoneMatch;
    });
  }, [orderStatusFilter, orderZoneFilter, orders]);

  const metrics = useMemo(() => {
    const activeOrders = orders.filter(
      (order) => !["delivered", "cancelled"].includes(order.status),
    ).length;
    const deliveredOrders = orders.filter((order) => order.status === "delivered").length;
    const availableRiders = riders.filter((rider) => rider.status === "available").length;
    const revenue = orders.reduce((sum, order) => sum + order.total, 0);
    const payout = orders.reduce((sum, order) => sum + order.payout, 0);
    return {
      activeOrders,
      deliveredOrders,
      availableRiders,
      revenue,
      payout,
    };
  }, [orders, riders]);

  const ordersByZone = useMemo(() => {
    return zones.map((zone) => ({
      zone,
      count: orders.filter((order) => order.zone === zone.name).length,
    }));
  }, [orders, zones]);

  const onRefresh = async () => {
    await Promise.all([
      ordersQuery.refetch(),
      ridersQuery.refetch(),
      zonesQuery.refetch(),
      appConfigQuery.refetch(),
    ]);
  };

  const assignRiderToOrder = async (order: Order, rider: Rider) => {
    const nextStatus: OrderStatus =
      order.status === "delivered" || order.status === "cancelled"
        ? order.status
        : "rider_assigned";

    await updateOrderMutation.mutateAsync({
      id: order.id,
      updates: {
        assignedRiderId: rider.id,
        status: nextStatus,
      },
    });
    await updateRiderMutation.mutateAsync({
      id: rider.id,
      updates: { status: "busy", zone: order.zone },
    });
    await queryClient.invalidateQueries({ queryKey: ["orders", "customer"] });
  };

  const advanceOrder = async (order: Order) => {
    const next = nextOrderStatus(order.status);
    if (!next) return;

    await updateOrderMutation.mutateAsync({
      id: order.id,
      updates: { status: next },
    });

    if (order.assignedRiderId) {
      await updateRiderMutation.mutateAsync({
        id: order.assignedRiderId,
        updates: { status: next === "delivered" ? "available" : "busy" },
      });
    }
  };

  const cancelOrder = (order: Order) => {
    Alert.alert("Cancel order", "This will mark the order cancelled in the backend.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel order",
        style: "destructive",
        onPress: async () => {
          await updateOrderMutation.mutateAsync({
            id: order.id,
            updates: { status: "cancelled" },
          });
          if (order.assignedRiderId) {
            await updateRiderMutation.mutateAsync({
              id: order.assignedRiderId,
              updates: { status: "available" },
            });
          }
        },
      },
    ]);
  };

  const submitRider = async () => {
    if (!riderName.trim() || !riderPhone.trim()) {
      Alert.alert("Missing details", "Rider name and phone are required.");
      return;
    }

    await createRiderMutation.mutateAsync({
      name: riderName.trim(),
      phone: riderPhone.trim(),
      vehicleType: riderVehicle,
      status: riderStatus,
      zone: riderZone,
      rating: 4.6,
      lat: null,
      lng: null,
    });

    setRiderName("");
    setRiderPhone("");
    setRiderVehicle(config.vehicleOptions[0]?.value ?? "Motorcycle");
    setRiderStatus("available");
  };

  const submitZone = async () => {
    if (!zoneName.trim() || !zoneColor.trim()) {
      Alert.alert("Missing details", "Zone name and color are required.");
      return;
    }

    await createZoneMutation.mutateAsync({
      name: zoneName.trim(),
      color: zoneColor.trim(),
      surgeMultiplier: toNumber(zoneSurgeMultiplier, 1.4),
      surgeActive: zoneSurgeActive,
      perKmRate: toNumber(zonePerKmRate, 12),
      minDeliveryFee: toNumber(zoneMinFee, 45),
    });

    setZoneName("");
    setZoneColor("#00C2FF");
    setZonePerKmRate("12");
    setZoneMinFee("45");
    setZoneSurgeMultiplier("1.4");
    setZoneSurgeActive(false);
  };

  const saveZoneDraft = async (zone: Zone) => {
    const draft = zoneDrafts[zone.id];
    if (!draft) return;

    await updateZoneMutation.mutateAsync({
      id: zone.id,
      updates: {
        perKmRate: toNumber(draft.perKmRate, zone.perKmRate),
        minDeliveryFee: toNumber(draft.minDeliveryFee, zone.minDeliveryFee),
        surgeMultiplier: toNumber(draft.surgeMultiplier, zone.surgeMultiplier),
        color: draft.color.trim() || zone.color,
        surgeActive: draft.surgeActive,
      },
    });
  };

  const runFatigueSimulation = async () => {
    const payload: SessionInputs = {
      drivingHours: toNumber(softDrivingHours, 0),
      deliveriesCompleted: Math.max(0, Math.round(toNumber(softDeliveries, 0))),
      minutesSinceBreak: Math.max(0, Math.round(toNumber(softBreakMinutes, 0))),
      hungerLevel: Math.max(1, Math.min(5, Math.round(toNumber(softHunger, 1)))),
      weather: softWeather,
      timeOfDay: softTimeOfDay,
    };

    await fatigueMutation.mutateAsync(payload);
  };

  const saveConfig = async () => {
    const nextConfig: AppConfig = {
      ...config,
      fatigueThresholds: {
        lowMax: toNumber(configDraft.lowMax, config.fatigueThresholds.lowMax),
        mediumMax: toNumber(configDraft.mediumMax, config.fatigueThresholds.mediumMax),
      },
      fatigueFactors: {
        ...config.fatigueFactors,
        hungerStep: toNumber(configDraft.hungerStep, config.fatigueFactors.hungerStep),
      },
      breakPolicy: {
        low: {
          ...config.breakPolicy.low,
          recommendedDurationMinutes: toNumber(
            configDraft.lowBreak,
            config.breakPolicy.low.recommendedDurationMinutes,
          ),
        },
        medium: {
          ...config.breakPolicy.medium,
          recommendedDurationMinutes: toNumber(
            configDraft.mediumBreak,
            config.breakPolicy.medium.recommendedDurationMinutes,
          ),
        },
        high: {
          ...config.breakPolicy.high,
          recommendedDurationMinutes: toNumber(
            configDraft.highBreak,
            config.breakPolicy.high.recommendedDurationMinutes,
          ),
        },
      },
      aso: {
        ...config.aso,
        ants: toNumber(configDraft.ants, config.aso.ants),
        iterations: toNumber(configDraft.iterations, config.aso.iterations),
        riskWeight: toNumber(configDraft.riskWeight, config.aso.riskWeight),
        priorityWeight: toNumber(configDraft.priorityWeight, config.aso.priorityWeight),
      },
    };

    await saveConfigMutation.mutateAsync(nextConfig);
  };

  const topPad = Platform.OS === "web" ? 68 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 42 : insets.bottom + 18;
  const refreshBusy =
    ordersQuery.isRefetching ||
    ridersQuery.isRefetching ||
    zonesQuery.isRefetching ||
    appConfigQuery.isRefetching;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}
      refreshControl={
        <RefreshControl refreshing={refreshBusy} onRefresh={onRefresh} tintColor={Colors.accent} />
      }
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>ADMIN CONSOLE</Text>
          <Text style={styles.title}>Operations and soft-computing controls</Text>
          <Text style={styles.subtitle}>
            Manage logistics data, run fatigue and ASO simulations, and tune live backend config.
          </Text>
        </View>
        <Pressable onPress={() => router.replace("/")} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={Colors.background} />
        </Pressable>
      </View>

      <View style={styles.segmentWrap}>
        {SECTION_ITEMS.map((item) => (
          <SegmentButton
            key={item.id}
            label={item.label}
            icon={item.icon}
            color={item.color}
            active={section === item.id}
            onPress={() => setSection(item.id)}
          />
        ))}
      </View>

      {section === "overview" && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <SectionLabel>LIVE SNAPSHOT</SectionLabel>
            <Text style={styles.helperText}>Backend synced</Text>
          </View>
          <View style={styles.kpiGrid}>
            <KpiCard label="Orders" value={`${orders.length}`} color={Colors.accent} helper="Total created" />
            <KpiCard label="Active" value={`${metrics.activeOrders}`} color={Colors.safe} helper="Not delivered" />
            <KpiCard label="Delivered" value={`${metrics.deliveredOrders}`} color={Colors.caution} helper="Completed" />
            <KpiCard label="Riders" value={`${riders.length}`} color={Colors.textSecondary} helper={`${metrics.availableRiders} available`} />
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Revenue tracked</Text>
              <Text style={[styles.summaryValue, { color: Colors.accent }]}>{formatMoney(metrics.revenue)}</Text>
              <Text style={styles.summaryHelper}>Order totals across the current dataset.</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Payout commitment</Text>
              <Text style={[styles.summaryValue, { color: Colors.safe }]}>{formatMoney(metrics.payout)}</Text>
              <Text style={styles.summaryHelper}>Rider-side payouts currently stored on orders.</Text>
            </View>
          </View>

          <SectionLabel>ZONE LOAD</SectionLabel>
          <View style={styles.listWrap}>
            {ordersByZone.length === 0 ? (
              <Text style={styles.emptyText}>No zones available yet.</Text>
            ) : (
              ordersByZone.map(({ zone, count }) => (
                <View key={zone.id} style={styles.overviewListCard}>
                  <View style={styles.overviewTopRow}>
                    <Text style={styles.overviewTitle}>{zone.name}</Text>
                    <StatusChip
                      label={zone.surgeActive ? `${zone.surgeMultiplier}x surge` : "Normal"}
                      color={zone.surgeActive ? Colors.caution : Colors.safe}
                    />
                  </View>
                  <Text style={styles.overviewMeta}>Orders: {count}</Text>
                  <Text style={styles.overviewMeta}>
                    Pricing: {formatMoney(zone.minDeliveryFee)} min, {formatMoney(zone.perKmRate)} / km
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {section === "orders" && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <SectionLabel>ORDERS</SectionLabel>
            <Text style={styles.helperText}>Create / assign / progress</Text>
          </View>

          <Text style={styles.inputLabel}>Status filter</Text>
          <View style={styles.filterWrap}>
            <Pressable
              onPress={() => setOrderStatusFilter("all")}
              style={[styles.selectorChip, orderStatusFilter === "all" && styles.selectorChipActive]}
            >
              <Text style={[styles.selectorChipText, orderStatusFilter === "all" && styles.selectorChipTextActive]}>All</Text>
            </Pressable>
            {ORDER_STATUSES.map((status) => (
              <Pressable
                key={status}
                onPress={() => setOrderStatusFilter(status)}
                style={[
                  styles.selectorChip,
                  orderStatusFilter === status && { backgroundColor: `${orderStatusColor(status)}18`, borderColor: `${orderStatusColor(status)}50` },
                ]}
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    orderStatusFilter === status && { color: orderStatusColor(status) },
                  ]}
                >
                  {status.replaceAll("_", " ")}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>Zone filter</Text>
          <View style={styles.filterWrap}>
            <Pressable
              onPress={() => setOrderZoneFilter("all")}
              style={[styles.selectorChip, orderZoneFilter === "all" && styles.selectorChipActive]}
            >
              <Text style={[styles.selectorChipText, orderZoneFilter === "all" && styles.selectorChipTextActive]}>All zones</Text>
            </Pressable>
            {zones.map((zone) => (
              <Pressable
                key={zone.id}
                onPress={() => setOrderZoneFilter(zone.name)}
                style={[
                  styles.selectorChip,
                  orderZoneFilter === zone.name && { backgroundColor: `${zone.color}18`, borderColor: `${zone.color}50` },
                ]}
              >
                <Text
                  style={[
                    styles.selectorChipText,
                    orderZoneFilter === zone.name && { color: zone.color },
                  ]}
                >
                  {zone.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.listWrap}>
            {filteredOrders.length === 0 ? (
              <Text style={styles.emptyText}>No orders match the current filters.</Text>
            ) : (
              filteredOrders.map((order) => {
                const assignedRider = order.assignedRiderId
                  ? riders.find((rider) => rider.id === order.assignedRiderId)
                  : null;
                const suggestedRiders = riders.filter(
                  (rider) => rider.status !== "offline" && (!rider.zone || rider.zone === order.zone),
                );
                const next = nextOrderStatus(order.status);

                return (
                  <View key={order.id} style={styles.entityCard}>
                    <View style={styles.entityHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entityTitle}>{order.storeName}</Text>
                        <Text style={styles.entitySub}>{order.dropAddress}</Text>
                      </View>
                      <StatusChip
                        label={order.status.replaceAll("_", " ").toUpperCase()}
                        color={orderStatusColor(order.status)}
                      />
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.metaText}>{order.zone}</Text>
                      <Text style={styles.metaText}>{formatMoney(order.total)}</Text>
                      <Text style={styles.metaText}>{order.estimatedMinutes} min</Text>
                    </View>

                    <Text style={styles.detailLine}>Items: {order.items.map((item) => item.name).join(", ")}</Text>
                    <Text style={styles.detailLine}>
                      Rider: {assignedRider ? `${assignedRider.name} (${assignedRider.vehicleType})` : "Not assigned"}
                    </Text>

                    <Text style={styles.assignLabel}>Suggested riders</Text>
                    <View style={styles.filterWrap}>
                      {suggestedRiders.length === 0 ? (
                        <Text style={styles.helperText}>No riders available in this zone.</Text>
                      ) : (
                        suggestedRiders.slice(0, 4).map((rider) => (
                          <Pressable
                            key={rider.id}
                            onPress={() => void assignRiderToOrder(order, rider)}
                            style={styles.secondaryBtn}
                          >
                            <Ionicons name="person-outline" size={14} color={Colors.accent} />
                            <Text style={styles.secondaryBtnText}>{rider.name}</Text>
                          </Pressable>
                        ))
                      )}
                    </View>

                    <View style={styles.actionsRow}>
                      {next && order.status !== "cancelled" && (
                        <Pressable onPress={() => void advanceOrder(order)} style={styles.primaryBtnSmall}>
                          <Ionicons name="arrow-forward-outline" size={14} color={Colors.background} />
                          <Text style={styles.primaryBtnSmallText}>Move to {next.replaceAll("_", " ")}</Text>
                        </Pressable>
                      )}
                      {!["delivered", "cancelled"].includes(order.status) && (
                        <Pressable onPress={() => cancelOrder(order)} style={styles.dangerBtnSmall}>
                          <Ionicons name="close-outline" size={14} color={Colors.danger} />
                          <Text style={styles.dangerBtnText}>Cancel</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}

      {section === "riders" && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <SectionLabel>RIDERS</SectionLabel>
            <Text style={styles.helperText}>Backend CRUD</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add rider</Text>
            <TextInput
              value={riderName}
              onChangeText={setRiderName}
              placeholder="Rider name"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
            />
            <TextInput
              value={riderPhone}
              onChangeText={setRiderPhone}
              placeholder="Phone"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Vehicle type</Text>
            <View style={styles.filterWrap}>
              {config.vehicleOptions.map((vehicle) => (
                <Pressable
                  key={vehicle.value}
                  onPress={() => setRiderVehicle(vehicle.value)}
                  style={[
                    styles.selectorChip,
                    riderVehicle === vehicle.value && styles.selectorChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorChipText,
                      riderVehicle === vehicle.value && styles.selectorChipTextActive,
                    ]}
                  >
                    {vehicle.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Status</Text>
            <View style={styles.filterWrap}>
              {RIDER_STATUSES.map((status) => (
                <Pressable
                  key={status}
                  onPress={() => setRiderStatus(status)}
                  style={[
                    styles.selectorChip,
                    riderStatus === status && { backgroundColor: `${riderStatusColor(status)}18`, borderColor: `${riderStatusColor(status)}50` },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorChipText,
                      riderStatus === status && { color: riderStatusColor(status) },
                    ]}
                  >
                    {status}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Zone</Text>
            <View style={styles.filterWrap}>
              {zones.map((zone) => (
                <Pressable
                  key={zone.id}
                  onPress={() => setRiderZone(zone.name)}
                  style={[
                    styles.selectorChip,
                    riderZone === zone.name && { backgroundColor: `${zone.color}18`, borderColor: `${zone.color}50` },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorChipText,
                      riderZone === zone.name && { color: zone.color },
                    ]}
                  >
                    {zone.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={() => void submitRider()} style={styles.primaryBtn}>
              <Ionicons name="person-add-outline" size={17} color={Colors.background} />
              <Text style={styles.primaryBtnText}>
                {createRiderMutation.isPending ? "Saving..." : "Create Rider"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.listWrap}>
            {riders.length === 0 ? (
              <Text style={styles.emptyText}>No riders available yet.</Text>
            ) : (
              riders.map((rider) => (
                <View key={rider.id} style={styles.entityCard}>
                  <View style={styles.entityHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entityTitle}>{rider.name}</Text>
                      <Text style={styles.entitySub}>{rider.vehicleType} - {rider.phone}</Text>
                    </View>
                    <StatusChip label={rider.status.toUpperCase()} color={riderStatusColor(rider.status)} />
                  </View>

                  <Text style={styles.detailLine}>Zone: {rider.zone ?? "Unassigned"}</Text>
                  <Text style={styles.detailLine}>Rating: {rider.rating ?? 4.5}</Text>

                  <Text style={styles.assignLabel}>Set status</Text>
                  <View style={styles.filterWrap}>
                    {RIDER_STATUSES.map((status) => (
                      <Pressable
                        key={status}
                        onPress={() =>
                          void updateRiderMutation.mutateAsync({
                            id: rider.id,
                            updates: { status },
                          })
                        }
                        style={styles.secondaryBtn}
                      >
                        <Text style={[styles.secondaryBtnText, { color: riderStatusColor(status) }]}>{status}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.assignLabel}>Assign zone</Text>
                  <View style={styles.filterWrap}>
                    {zones.map((zone) => (
                      <Pressable
                        key={zone.id}
                        onPress={() =>
                          void updateRiderMutation.mutateAsync({
                            id: rider.id,
                            updates: { zone: zone.name },
                          })
                        }
                        style={styles.secondaryBtn}
                      >
                        <Text style={[styles.secondaryBtnText, { color: zone.color }]}>{zone.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      )}

      {section === "zones" && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <SectionLabel>ZONES</SectionLabel>
            <Text style={styles.helperText}>Pricing and surge controls</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Create zone</Text>
            <TextInput
              value={zoneName}
              onChangeText={setZoneName}
              placeholder="Zone name"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
            />
            <TextInput
              value={zoneColor}
              onChangeText={setZoneColor}
              placeholder="#00C2FF"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
            />
            <View style={styles.inputGrid}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Per km fee</Text>
                <TextInput
                  value={zonePerKmRate}
                  onChangeText={setZonePerKmRate}
                  placeholder="12"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Min fee</Text>
                <TextInput
                  value={zoneMinFee}
                  onChangeText={setZoneMinFee}
                  placeholder="45"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <Text style={styles.inputLabel}>Surge multiplier</Text>
            <TextInput
              value={zoneSurgeMultiplier}
              onChangeText={setZoneSurgeMultiplier}
              placeholder="1.4"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
              keyboardType="decimal-pad"
            />

            <Pressable
              onPress={() => setZoneSurgeActive((current) => !current)}
              style={[styles.toggleRow, zoneSurgeActive && { borderColor: `${Colors.caution}50` }]}
            >
              <Text style={styles.toggleText}>Surge active</Text>
              <StatusChip label={zoneSurgeActive ? "ON" : "OFF"} color={zoneSurgeActive ? Colors.caution : Colors.textMuted} />
            </Pressable>

            <Pressable onPress={() => void submitZone()} style={styles.primaryBtn}>
              <Ionicons name="add-circle-outline" size={17} color={Colors.background} />
              <Text style={styles.primaryBtnText}>
                {createZoneMutation.isPending ? "Saving..." : "Create Zone"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.listWrap}>
            {zones.length === 0 ? (
              <Text style={styles.emptyText}>No zones created yet.</Text>
            ) : (
              zones.map((zone) => {
                const draft = zoneDrafts[zone.id];
                if (!draft) return null;

                return (
                  <View key={zone.id} style={styles.entityCard}>
                    <View style={styles.entityHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entityTitle}>{zone.name}</Text>
                        <Text style={styles.entitySub}>Edit pricing and ASO route cost context.</Text>
                      </View>
                      <StatusChip label={zone.surgeActive ? "SURGE" : "STANDARD"} color={zone.surgeActive ? Colors.caution : Colors.safe} />
                    </View>

                    <TextInput
                      value={draft.color}
                      onChangeText={(value) =>
                        setZoneDrafts((current) => ({
                          ...current,
                          [zone.id]: { ...current[zone.id], color: value },
                        }))
                      }
                      placeholder="#00C2FF"
                      placeholderTextColor={Colors.textMuted}
                      style={styles.textInput}
                    />

                    <View style={styles.inputGrid}>
                      <View style={styles.inputHalf}>
                        <Text style={styles.inputLabel}>Per km</Text>
                        <TextInput
                          value={draft.perKmRate}
                          onChangeText={(value) =>
                            setZoneDrafts((current) => ({
                              ...current,
                              [zone.id]: { ...current[zone.id], perKmRate: value },
                            }))
                          }
                          keyboardType="decimal-pad"
                          placeholderTextColor={Colors.textMuted}
                          style={styles.textInput}
                        />
                      </View>
                      <View style={styles.inputHalf}>
                        <Text style={styles.inputLabel}>Min fee</Text>
                        <TextInput
                          value={draft.minDeliveryFee}
                          onChangeText={(value) =>
                            setZoneDrafts((current) => ({
                              ...current,
                              [zone.id]: { ...current[zone.id], minDeliveryFee: value },
                            }))
                          }
                          keyboardType="decimal-pad"
                          placeholderTextColor={Colors.textMuted}
                          style={styles.textInput}
                        />
                      </View>
                    </View>

                    <Text style={styles.inputLabel}>Surge multiplier</Text>
                    <TextInput
                      value={draft.surgeMultiplier}
                      onChangeText={(value) =>
                        setZoneDrafts((current) => ({
                          ...current,
                          [zone.id]: { ...current[zone.id], surgeMultiplier: value },
                        }))
                      }
                      keyboardType="decimal-pad"
                      placeholderTextColor={Colors.textMuted}
                      style={styles.textInput}
                    />

                    <Pressable
                      onPress={() =>
                        setZoneDrafts((current) => ({
                          ...current,
                          [zone.id]: { ...current[zone.id], surgeActive: !current[zone.id].surgeActive },
                        }))
                      }
                      style={[styles.toggleRow, draft.surgeActive && { borderColor: `${Colors.caution}50` }]}
                    >
                      <Text style={styles.toggleText}>Surge active</Text>
                      <StatusChip label={draft.surgeActive ? "ON" : "OFF"} color={draft.surgeActive ? Colors.caution : Colors.textMuted} />
                    </Pressable>

                    <Pressable onPress={() => void saveZoneDraft(zone)} style={styles.primaryBtnSmall}>
                      <Ionicons name="save-outline" size={14} color={Colors.background} />
                      <Text style={styles.primaryBtnSmallText}>Save zone</Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}

      {section === "soft" && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <SectionLabel>SOFT COMPUTING</SectionLabel>
            <Text style={styles.helperText}>`/api/soft/*`</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Fatigue simulator</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Driving hours</Text>
                <TextInput
                  value={softDrivingHours}
                  onChangeText={setSoftDrivingHours}
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Deliveries</Text>
                <TextInput
                  value={softDeliveries}
                  onChangeText={setSoftDeliveries}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
            </View>
            <View style={styles.inputGrid}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Minutes since break</Text>
                <TextInput
                  value={softBreakMinutes}
                  onChangeText={setSoftBreakMinutes}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Hunger (1-5)</Text>
                <TextInput
                  value={softHunger}
                  onChangeText={setSoftHunger}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Weather</Text>
            <View style={styles.filterWrap}>
              {config.weatherOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setSoftWeather(option.value as SessionInputs["weather"])}
                  style={[
                    styles.selectorChip,
                    softWeather === option.value && styles.selectorChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorChipText,
                      softWeather === option.value && styles.selectorChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.inputLabel}>Time of day</Text>
            <View style={styles.filterWrap}>
              {config.timeOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setSoftTimeOfDay(option.value as SessionInputs["timeOfDay"])}
                  style={[
                    styles.selectorChip,
                    softTimeOfDay === option.value && styles.selectorChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectorChipText,
                      softTimeOfDay === option.value && styles.selectorChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={() => void runFatigueSimulation()} style={styles.primaryBtn}>
              <Ionicons name="flash-outline" size={17} color={Colors.background} />
              <Text style={styles.primaryBtnText}>
                {fatigueMutation.isPending ? "Running..." : "Evaluate fatigue"}
              </Text>
            </Pressable>
          </View>

          {softResult && softPrediction && softBreakAdvice && (
            <View style={styles.resultsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.formTitle}>Fatigue output</Text>
                <StatusChip label={softResult.level.toUpperCase()} color={orderStatusColor(softResult.level === "low" ? "confirmed" : softResult.level === "medium" ? "preparing" : "cancelled")} />
              </View>
              <View style={styles.kpiGrid}>
                <KpiCard label="Score" value={`${Math.round(softResult.score)}`} color={Colors.accent} helper="0-100 fatigue index" />
                <KpiCard label="Next level" value={softPrediction.nextLevel.toUpperCase()} color={Colors.caution} helper={softPrediction.minutesRemaining === null ? "Already highest" : `${softPrediction.minutesRemaining} min remaining`} />
              </View>
              <Text style={styles.detailLine}>Break: {softBreakAdvice.message}</Text>
              <Text style={styles.detailLine}>Urgency: {softBreakAdvice.urgency}</Text>
            </View>
          )}

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>ASO route optimizer</Text>
            <Text style={styles.helperText}>
              Uses the current order pool and the latest simulated fatigue score.
            </Text>
            <Text style={styles.inputLabel}>Stops to optimize</Text>
            <TextInput
              value={routeStopCount}
              onChangeText={setRouteStopCount}
              keyboardType="number-pad"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
            />
            <Pressable onPress={() => void routeMutation.mutateAsync()} style={styles.primaryBtn}>
              <Ionicons name="git-network-outline" size={17} color={Colors.background} />
              <Text style={styles.primaryBtnText}>
                {routeMutation.isPending ? "Optimizing..." : "Run ASO"}
              </Text>
            </Pressable>
          </View>

          {routeResult && (
            <View style={styles.resultsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.formTitle}>Route result</Text>
                <Text style={styles.helperText}>{routeResult.iterations} iterations</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{routeResult.totalTime} min total</Text>
                <Text style={styles.metaText}>Break after stop {routeResult.breakAfterStop}</Text>
                <Text style={styles.metaText}>Pheromone {routeResult.pheromoneStrength}</Text>
              </View>
              <View style={styles.listWrap}>
                {routeResult.stops.map((stop, index) => (
                  <View key={`${stop.id}-${index}`} style={styles.routeStopCard}>
                    <Text style={styles.routeStopTitle}>{index + 1}. {stop.label}</Text>
                    <Text style={styles.routeStopMeta}>{stop.address}</Text>
                    <Text style={styles.routeStopMeta}>Risk {stop.risk} | {stop.estimatedMinutes} min | Priority {stop.priority}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {section === "config" && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <SectionLabel>APP CONFIG</SectionLabel>
            <Text style={styles.helperText}>`PUT /api/app-config`</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Fatigue thresholds</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Low max</Text>
                <TextInput
                  value={configDraft.lowMax}
                  onChangeText={(value) => setConfigDraft((current) => ({ ...current, lowMax: value }))}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Medium max</Text>
                <TextInput
                  value={configDraft.mediumMax}
                  onChangeText={(value) => setConfigDraft((current) => ({ ...current, mediumMax: value }))}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
            </View>

            <Text style={styles.formTitle}>Break durations</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Low level</Text>
                <TextInput
                  value={configDraft.lowBreak}
                  onChangeText={(value) => setConfigDraft((current) => ({ ...current, lowBreak: value }))}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Medium level</Text>
                <TextInput
                  value={configDraft.mediumBreak}
                  onChangeText={(value) => setConfigDraft((current) => ({ ...current, mediumBreak: value }))}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
            </View>
            <Text style={styles.inputLabel}>High level</Text>
            <TextInput
              value={configDraft.highBreak}
              onChangeText={(value) => setConfigDraft((current) => ({ ...current, highBreak: value }))}
              keyboardType="number-pad"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
            />

            <Text style={styles.formTitle}>Factor tuning</Text>
            <Text style={styles.inputLabel}>Hunger step weight</Text>
            <TextInput
              value={configDraft.hungerStep}
              onChangeText={(value) => setConfigDraft((current) => ({ ...current, hungerStep: value }))}
              keyboardType="decimal-pad"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
            />

            <Text style={styles.formTitle}>ASO parameters</Text>
            <View style={styles.inputGrid}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Ants</Text>
                <TextInput
                  value={configDraft.ants}
                  onChangeText={(value) => setConfigDraft((current) => ({ ...current, ants: value }))}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Iterations</Text>
                <TextInput
                  value={configDraft.iterations}
                  onChangeText={(value) => setConfigDraft((current) => ({ ...current, iterations: value }))}
                  keyboardType="number-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
            </View>
            <View style={styles.inputGrid}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Risk weight</Text>
                <TextInput
                  value={configDraft.riskWeight}
                  onChangeText={(value) => setConfigDraft((current) => ({ ...current, riskWeight: value }))}
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Priority weight</Text>
                <TextInput
                  value={configDraft.priorityWeight}
                  onChangeText={(value) => setConfigDraft((current) => ({ ...current, priorityWeight: value }))}
                  keyboardType="decimal-pad"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.textInput}
                />
              </View>
            </View>

            <Pressable onPress={() => void saveConfig()} style={styles.primaryBtn}>
              <Ionicons name="save-outline" size={17} color={Colors.background} />
              <Text style={styles.primaryBtnText}>
                {saveConfigMutation.isPending ? "Saving..." : "Save Config"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 12,
    letterSpacing: 2.2,
    color: Colors.caution,
    marginBottom: 6,
  },
  title: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 30,
    lineHeight: 34,
    color: Colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.caution,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  segmentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundCard,
  },
  segmentButtonText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  helperText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    minWidth: "47%",
    flexGrow: 1,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  kpiLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  kpiValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 24,
    marginBottom: 4,
  },
  kpiHelper: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  summaryValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 24,
    marginBottom: 6,
  },
  summaryHelper: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  overviewListCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  overviewTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  overviewTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 19,
    color: Colors.text,
  },
  overviewMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 0.8,
  },
  formCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 14,
  },
  formTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 21,
    color: Colors.text,
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    marginBottom: 10,
  },
  inputLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  inputGrid: {
    flexDirection: "row",
    gap: 10,
  },
  inputHalf: {
    flex: 1,
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  selectorChip: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectorChipActive: {
    backgroundColor: Colors.accentGlow,
    borderColor: `${Colors.accent}60`,
  },
  selectorChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  selectorChipTextActive: {
    color: Colors.accent,
  },
  primaryBtn: {
    marginTop: 4,
    backgroundColor: Colors.caution,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 16,
    color: Colors.background,
    letterSpacing: 0.6,
  },
  primaryBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: Colors.safe,
  },
  primaryBtnSmallText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
    color: Colors.background,
  },
  dangerBtnSmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: `${Colors.danger}40`,
  },
  dangerBtnText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
    color: Colors.danger,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
    color: Colors.accent,
  },
  listWrap: {
    gap: 10,
  },
  entityCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  entityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  entityTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 21,
    color: Colors.text,
  },
  entitySub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  metaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: Colors.backgroundCard,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  detailLine: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  assignLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 12,
    letterSpacing: 1.4,
    color: Colors.textMuted,
    marginTop: 6,
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  toggleText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.text,
  },
  resultsCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 14,
  },
  routeStopCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  routeStopTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 17,
    color: Colors.text,
    marginBottom: 4,
  },
  routeStopMeta: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
  },
});
