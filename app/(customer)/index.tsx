import AsyncStorage from "@react-native-async-storage/async-storage";
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
import Colors from "@/constants/colors";
import {
  type CreateOrderInput,
  type Order,
  createOrder,
  estimateDeliveryFee,
  fetchCustomerOrders,
  fetchRiders,
  fetchZones,
  formatMoney,
  getDemoCoordinates,
  orderStatusColor,
  updateOrder,
} from "@/lib/logistics-api";

const CUSTOMER_ID_KEY = "saferoute_customer_id";
const CUSTOMER_NAME_KEY = "saferoute_customer_name";
const TRACKING_FLOW = [
  "pending",
  "confirmed",
  "preparing",
  "rider_assigned",
  "picked_up",
  "out_for_delivery",
  "delivered",
] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function StatusChip({ status }: { status: Order["status"] }) {
  const color = orderStatusColor(status);
  return (
    <View style={[styles.statusChip, { backgroundColor: `${color}18`, borderColor: `${color}50` }]}>
      <Text style={[styles.statusChipText, { color }]}>{status.replaceAll("_", " ").toUpperCase()}</Text>
    </View>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.metricCard, { borderColor: `${color}40` }]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

function OrderTimeline({ status }: { status: Order["status"] }) {
  const activeIndex = TRACKING_FLOW.findIndex((step) => step === status);

  return (
    <View style={styles.timeline}>
      {TRACKING_FLOW.map((step, index) => {
        const isReached = activeIndex >= index || status === "cancelled";
        const isCurrent = status === step;
        const color =
          status === "cancelled"
            ? Colors.danger
            : isReached
              ? Colors.safe
              : Colors.border;

        return (
          <View key={step} style={styles.timelineItem}>
            <View style={styles.timelineTopRow}>
              <View style={[styles.timelineDot, { backgroundColor: color }]} />
              {index < TRACKING_FLOW.length - 1 && (
                <View style={[styles.timelineLine, { backgroundColor: isReached ? Colors.safe : Colors.border }]} />
              )}
            </View>
            <Text
              style={[
                styles.timelineText,
                isCurrent && { color: Colors.text },
              ]}
            >
              {step.replaceAll("_", " ")}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function CustomerHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [identityReady, setIdentityReady] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropAddress, setDropAddress] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [distanceKm, setDistanceKm] = useState("4");
  const [estimatedMinutes, setEstimatedMinutes] = useState("20");
  const [orderValue, setOrderValue] = useState("250");

  useEffect(() => {
    const loadIdentity = async () => {
      const savedId = await AsyncStorage.getItem(CUSTOMER_ID_KEY);
      const savedName = await AsyncStorage.getItem(CUSTOMER_NAME_KEY);
      const nextId = savedId || `cust-${Date.now().toString(36)}`;

      setCustomerId(nextId);
      setCustomerName(savedName || "Varun");
      setIdentityReady(true);

      if (!savedId) {
        await AsyncStorage.setItem(CUSTOMER_ID_KEY, nextId);
      }
    };

    void loadIdentity();
  }, []);

  useEffect(() => {
    if (!identityReady) return;
    void AsyncStorage.setItem(CUSTOMER_NAME_KEY, customerName.trim() || "Varun");
  }, [customerName, identityReady]);

  const zonesQuery = useQuery({
    queryKey: ["zones"],
    queryFn: fetchZones,
  });
  const ridersQuery = useQuery({
    queryKey: ["riders"],
    queryFn: fetchRiders,
  });
  const ordersQuery = useQuery({
    queryKey: ["orders", "customer", customerId],
    queryFn: () => fetchCustomerOrders(customerId),
    enabled: customerId.length > 0,
  });

  useEffect(() => {
    if (!selectedZone && zonesQuery.data?.length) {
      setSelectedZone(zonesQuery.data[0].name);
    }
  }, [selectedZone, zonesQuery.data]);

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: ["orders", "customer", customerId] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      setStoreName("");
      setItemsText("");
      setPickupAddress("");
      setDropAddress("");
      setDistanceKm("4");
      setEstimatedMinutes("20");
      setOrderValue("250");
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Order> }) =>
      updateOrder(id, updates),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders", "customer", customerId] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const zone = useMemo(
    () => zonesQuery.data?.find((item) => item.name === selectedZone),
    [selectedZone, zonesQuery.data],
  );

  const numericDistance = Number(distanceKm) || 0;
  const numericEta = Math.max(5, Number(estimatedMinutes) || 20);
  const baseOrderValue = Number(orderValue) || 0;
  const deliveryFee = estimateDeliveryFee(zone, numericDistance);
  const finalTotal = baseOrderValue + deliveryFee;
  const allOrders = ordersQuery.data ?? [];
  const activeOrder = allOrders.find(
    (item) => item.status !== "delivered" && item.status !== "cancelled",
  );

  const riderById = useMemo(() => {
    return new Map((ridersQuery.data ?? []).map((rider) => [rider.id, rider]));
  }, [ridersQuery.data]);

  const onRefresh = async () => {
    await Promise.all([
      zonesQuery.refetch(),
      ridersQuery.refetch(),
      ordersQuery.refetch(),
    ]);
  };

  const buildItems = () =>
    itemsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((name) => ({ name, quantity: 1 }));

  const submitOrder = async () => {
    const trimmedName = customerName.trim();
    if (!trimmedName || !storeName.trim() || !pickupAddress.trim() || !dropAddress.trim()) {
      Alert.alert("Missing details", "Fill customer name, store name, pickup, and drop address.");
      return;
    }

    const items = buildItems();
    if (items.length === 0) {
      Alert.alert("Add items", "Enter at least one item separated by commas.");
      return;
    }

    const zoneIndex = Math.max(
      0,
      (zonesQuery.data ?? []).findIndex((item) => item.name === selectedZone),
    );
    const coords = getDemoCoordinates(zoneIndex, numericDistance);
    const payload: CreateOrderInput = {
      customerId,
      storeName: storeName.trim(),
      status: "pending",
      total: finalTotal,
      items,
      pickupAddress: pickupAddress.trim(),
      dropAddress: dropAddress.trim(),
      pickupLat: coords.pickupLat,
      pickupLng: coords.pickupLng,
      dropLat: coords.dropLat,
      dropLng: coords.dropLng,
      distance: numericDistance,
      estimatedMinutes: numericEta,
      assignedRiderId: null,
      payout: deliveryFee,
      surge: zone?.surgeActive ? zone.surgeMultiplier : 1,
      zone: selectedZone,
    };

    await AsyncStorage.setItem(CUSTOMER_NAME_KEY, trimmedName);
    await createOrderMutation.mutateAsync(payload);
  };

  const repeatOrder = (order: Order) => {
    setStoreName(order.storeName);
    setItemsText(order.items.map((item) => item.name).join(", "));
    setPickupAddress(order.pickupAddress);
    setDropAddress(order.dropAddress);
    setSelectedZone(order.zone);
    setDistanceKm(String(order.distance));
    setEstimatedMinutes(String(order.estimatedMinutes));
    setOrderValue(String(Math.max(0, Math.round(order.total - order.payout))));
  };

  const cancelOrder = (order: Order) => {
    Alert.alert("Cancel order", "This will update the live order status to cancelled.", [
      { text: "Keep order", style: "cancel" },
      {
        text: "Cancel order",
        style: "destructive",
        onPress: () =>
          updateOrderMutation.mutate({
            id: order.id,
            updates: { status: "cancelled" },
          }),
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 68 : insets.top + 16;
  const bottomPad = Platform.OS === "web" ? 40 : insets.bottom + 18;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={zonesQuery.isRefetching || ordersQuery.isRefetching || ridersQuery.isRefetching}
          onRefresh={onRefresh}
          tintColor={Colors.accent}
        />
      }
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>CUSTOMER</Text>
          <Text style={styles.title}>Order and track deliveries</Text>
          <Text style={styles.subtitle}>Live backend orders, rider assignment, and delivery status updates.</Text>
        </View>
        <Pressable onPress={() => router.replace("/")} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color={Colors.background} />
        </Pressable>
      </View>

      <View style={styles.identityCard}>
        <View style={styles.identityHeader}>
          <SectionLabel>IDENTITY</SectionLabel>
          <Text style={styles.identityId}>ID: {customerId || "..."}</Text>
        </View>
        <TextInput
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Customer name"
          placeholderTextColor={Colors.textMuted}
          style={styles.textInput}
        />
        <View style={styles.metricRow}>
          <MetricCard label="Orders" value={`${allOrders.length}`} color={Colors.accent} />
          <MetricCard label="Active" value={activeOrder ? "1" : "0"} color={Colors.safe} />
          <MetricCard label="Spent" value={formatMoney(allOrders.reduce((sum, order) => sum + order.total, 0))} color={Colors.caution} />
        </View>
      </View>

      {activeOrder ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <SectionLabel>LIVE ORDER</SectionLabel>
            <StatusChip status={activeOrder.status} />
          </View>
          <Text style={styles.cardTitle}>{activeOrder.storeName}</Text>
          <Text style={styles.cardSub}>{activeOrder.dropAddress}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{formatMoney(activeOrder.total)}</Text>
            <Text style={styles.metaText}>{activeOrder.estimatedMinutes} min ETA</Text>
            <Text style={styles.metaText}>{activeOrder.zone}</Text>
          </View>
          <OrderTimeline status={activeOrder.status} />
          <View style={styles.detailBox}>
            <Text style={styles.detailText}>
              Rider:{" "}
              <Text style={styles.detailStrong}>
                {activeOrder.assignedRiderId
                  ? riderById.get(activeOrder.assignedRiderId)?.name ?? "Assigned"
                  : "Waiting for assignment"}
              </Text>
            </Text>
            <Text style={styles.detailText}>
              Payout: <Text style={styles.detailStrong}>{formatMoney(activeOrder.payout)}</Text>
            </Text>
          </View>
          {["pending", "confirmed", "preparing"].includes(activeOrder.status) && (
            <Pressable onPress={() => cancelOrder(activeOrder)} style={styles.cancelBtn}>
              <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
              <Text style={styles.cancelText}>Cancel active order</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <SectionLabel>LIVE ORDER</SectionLabel>
          <Text style={styles.emptyTitle}>No active delivery</Text>
          <Text style={styles.emptyText}>
            Place a new order below. It will immediately appear here and track status from the backend.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <SectionLabel>PLACE ORDER</SectionLabel>
          <Text style={styles.helperText}>Backend: `POST /api/orders`</Text>
        </View>

        <TextInput
          value={storeName}
          onChangeText={setStoreName}
          placeholder="Store name"
          placeholderTextColor={Colors.textMuted}
          style={styles.textInput}
        />
        <TextInput
          value={itemsText}
          onChangeText={setItemsText}
          placeholder="Items, comma separated"
          placeholderTextColor={Colors.textMuted}
          style={styles.textInput}
        />
        <TextInput
          value={pickupAddress}
          onChangeText={setPickupAddress}
          placeholder="Pickup address"
          placeholderTextColor={Colors.textMuted}
          style={styles.textInput}
        />
        <TextInput
          value={dropAddress}
          onChangeText={setDropAddress}
          placeholder="Drop address"
          placeholderTextColor={Colors.textMuted}
          style={styles.textInput}
        />

        <SectionLabel>ZONE</SectionLabel>
        <View style={styles.chipWrap}>
          {(zonesQuery.data ?? []).map((item) => {
            const active = selectedZone === item.name;
            return (
              <Pressable
                key={item.id}
                onPress={() => setSelectedZone(item.name)}
                style={[
                  styles.selectorChip,
                  active && { backgroundColor: `${item.color}20`, borderColor: `${item.color}60` },
                ]}
              >
                <Text style={[styles.selectorChipText, active && { color: item.color }]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.inputGrid}>
          <View style={styles.inputHalf}>
            <Text style={styles.inputLabel}>Distance (km)</Text>
            <TextInput
              value={distanceKm}
              onChangeText={setDistanceKm}
              keyboardType="decimal-pad"
              placeholder="4"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
            />
          </View>
          <View style={styles.inputHalf}>
            <Text style={styles.inputLabel}>ETA (min)</Text>
            <TextInput
              value={estimatedMinutes}
              onChangeText={setEstimatedMinutes}
              keyboardType="number-pad"
              placeholder="20"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
            />
          </View>
        </View>

        <Text style={styles.inputLabel}>Order value (without delivery fee)</Text>
        <TextInput
          value={orderValue}
          onChangeText={setOrderValue}
          keyboardType="decimal-pad"
          placeholder="250"
          placeholderTextColor={Colors.textMuted}
          style={styles.textInput}
        />

        <View style={styles.estimateCard}>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Delivery fee</Text>
            <Text style={styles.estimateValue}>{formatMoney(deliveryFee)}</Text>
          </View>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Final total</Text>
            <Text style={[styles.estimateValue, { color: Colors.accent }]}>{formatMoney(finalTotal)}</Text>
          </View>
          {zone && (
            <Text style={styles.helperText}>
              Zone {zone.name}: {zone.surgeActive ? `${zone.surgeMultiplier}x surge active` : "normal pricing"}
            </Text>
          )}
        </View>

        <Pressable
          onPress={() => void submitOrder()}
          disabled={createOrderMutation.isPending}
          style={[styles.primaryBtn, createOrderMutation.isPending && styles.disabledBtn]}
        >
          <Ionicons name="bag-check-outline" size={18} color={Colors.background} />
          <Text style={styles.primaryBtnText}>
            {createOrderMutation.isPending ? "Placing..." : "Place Order"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <SectionLabel>ORDER HISTORY</SectionLabel>
          <Text style={styles.helperText}>{allOrders.length} orders</Text>
        </View>
        {ordersQuery.isLoading ? (
          <Text style={styles.emptyText}>Loading customer orders...</Text>
        ) : allOrders.length === 0 ? (
          <Text style={styles.emptyText}>No orders yet. Your placed orders will appear here.</Text>
        ) : (
          <View style={styles.listWrap}>
            {allOrders.map((order) => {
              const rider = order.assignedRiderId ? riderById.get(order.assignedRiderId) : null;

              return (
                <View key={order.id} style={styles.orderCard}>
                  <View style={styles.orderCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderCardTitle}>{order.storeName}</Text>
                      <Text style={styles.orderCardSub}>
                        {new Date(order.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <StatusChip status={order.status} />
                  </View>

                  <Text style={styles.orderLine}>Items: {order.items.map((item) => item.name).join(", ")}</Text>
                  <Text style={styles.orderLine}>Delivery to: {order.dropAddress}</Text>
                  <Text style={styles.orderLine}>
                    Rider: {rider ? `${rider.name} (${rider.vehicleType})` : "Not assigned yet"}
                  </Text>

                  <View style={styles.orderMetaRow}>
                    <Text style={styles.orderMetaStrong}>{formatMoney(order.total)}</Text>
                    <Text style={styles.orderMeta}>{order.estimatedMinutes} min</Text>
                    <Text style={styles.orderMeta}>{order.zone}</Text>
                  </View>

                  <View style={styles.orderActions}>
                    <Pressable onPress={() => repeatOrder(order)} style={styles.secondaryBtn}>
                      <Ionicons name="repeat-outline" size={15} color={Colors.accent} />
                      <Text style={styles.secondaryBtnText}>Repeat</Text>
                    </Pressable>
                    {["pending", "confirmed", "preparing"].includes(order.status) && (
                      <Pressable onPress={() => cancelOrder(order)} style={styles.secondaryBtn}>
                        <Ionicons name="close-outline" size={15} color={Colors.danger} />
                        <Text style={[styles.secondaryBtnText, { color: Colors.danger }]}>Cancel</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 12,
    color: Colors.safe,
    letterSpacing: 2.3,
    marginBottom: 6,
  },
  title: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 30,
    color: Colors.text,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.safe,
    alignItems: "center",
    justifyContent: "center",
  },
  identityCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  identityHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  identityId: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  metricRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  metricLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  metricValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 22,
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
    marginBottom: 12,
    gap: 8,
  },
  sectionLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  cardTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 24,
    color: Colors.text,
  },
  cardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metaText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: Colors.backgroundElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
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
    letterSpacing: 1,
  },
  timeline: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 12,
  },
  timelineItem: {
    flex: 1,
    alignItems: "center",
  },
  timelineTopRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    flex: 1,
    height: 2,
  },
  timelineText: {
    marginTop: 6,
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: "center",
  },
  detailBox: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  detailText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  detailStrong: {
    color: Colors.text,
    fontFamily: "Inter_500Medium",
  },
  cancelBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.dangerDim,
  },
  cancelText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
    color: Colors.danger,
  },
  emptyTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 22,
    color: Colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  helperText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  inputLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.backgroundElevated,
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
  chipWrap: {
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
  selectorChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  inputGrid: {
    flexDirection: "row",
    gap: 10,
  },
  inputHalf: {
    flex: 1,
  },
  estimateCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  estimateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  estimateLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  estimateValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 18,
    color: Colors.text,
  },
  primaryBtn: {
    backgroundColor: Colors.safe,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 16,
    color: Colors.background,
    letterSpacing: 0.7,
  },
  listWrap: {
    gap: 10,
  },
  orderCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  orderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  orderCardTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 19,
    color: Colors.text,
  },
  orderCardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  orderLine: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
    lineHeight: 17,
  },
  orderMetaRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  orderMetaStrong: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 18,
    color: Colors.accent,
  },
  orderMeta: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.textMuted,
  },
  orderActions: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
    color: Colors.accent,
  },
});
