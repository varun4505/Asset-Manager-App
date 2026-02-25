import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  FadeInDown,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useFatigue } from "@/context/FatigueContext";
import { generateRoute, getBreakRecommendation } from "@/lib/fatigueEngine";

interface RouteStop {
  id: number;
  label: string;
  priority: number;
  estimatedMinutes: number;
  risk: number;
}

interface RouteData {
  stops: RouteStop[];
  totalTime: number;
  breakAfterStop: number;
}

function BreakTimer({ onEnd }: { onEnd: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const [target, setTarget] = useState(15 * 60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { breakStartTime } = useFatigue();

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (breakStartTime) {
        const elapsed = Math.floor((Date.now() - breakStartTime) / 1000);
        setSeconds(elapsed);
      }
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [breakStartTime]);

  const pct = Math.min(1, seconds / target);
  const remaining = Math.max(0, target - seconds);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <View style={styles.breakTimerCard}>
      <View style={styles.breakTimerHeader}>
        <Ionicons name="cafe" size={20} color={Colors.safe} />
        <Text style={styles.breakTimerTitle}>BREAK IN PROGRESS</Text>
      </View>
      <View style={styles.breakTimerCircle}>
        <Text style={styles.breakTimerTime}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </Text>
        <Text style={styles.breakTimerRemaining}>remaining</Text>
      </View>
      <View style={styles.breakProgressTrack}>
        <View style={[styles.breakProgressFill, { width: `${pct * 100}%` }]} />
      </View>
      <Pressable onPress={onEnd} style={styles.endBreakBtn}>
        <Text style={styles.endBreakText}>End Break</Text>
      </Pressable>
    </View>
  );
}

function StopCard({ stop, index, isBreakAfter, isCompleted, onComplete }: {
  stop: RouteStop;
  index: number;
  isBreakAfter: boolean;
  isCompleted: boolean;
  onComplete: () => void;
}) {
  const riskColor = stop.risk > 30 ? Colors.danger : stop.risk > 15 ? Colors.caution : Colors.safe;
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(0.95), withSpring(1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onComplete();
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).springify()}>
      <View style={[styles.stopCard, isCompleted && styles.stopCardCompleted]}>
        <View style={styles.stopLeftCol}>
          <Animated.View style={animStyle}>
            <Pressable
              onPress={handlePress}
              style={[
                styles.stopCheck,
                isCompleted
                  ? { backgroundColor: Colors.safe, borderColor: Colors.safe }
                  : { borderColor: Colors.border },
              ]}
            >
              {isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
            </Pressable>
          </Animated.View>
          <View style={styles.stopLine} />
        </View>
        <View style={styles.stopContent}>
          <View style={styles.stopHeader}>
            <Text style={[styles.stopLabel, isCompleted && styles.stopLabelDone]}>
              {stop.label}
            </Text>
            <View style={[styles.riskBadge, { backgroundColor: riskColor + "20" }]}>
              <Text style={[styles.riskBadgeText, { color: riskColor }]}>
                Risk {stop.risk}%
              </Text>
            </View>
          </View>
          <View style={styles.stopMeta}>
            <View style={styles.stopMetaItem}>
              <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.stopMetaText}>{stop.estimatedMinutes} min</Text>
            </View>
            <View style={styles.stopMetaItem}>
              <Ionicons name="flash-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.stopMetaText}>P{stop.priority}</Text>
            </View>
          </View>
          {isBreakAfter && !isCompleted && (
            <View style={styles.breakMarker}>
              <Ionicons name="cafe-outline" size={12} color={Colors.caution} />
              <Text style={styles.breakMarkerText}>Recommended break after this stop</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export default function RoutesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { fatigueScore, fatigueLevel, session, activeBreak, startBreak, endBreak } = useFatigue();
  const [route, setRoute] = useState<RouteData | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const rec = getBreakRecommendation(fatigueScore, fatigueLevel, session.minutesSinceBreak);

  const generateNewRoute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const deliveries = Math.max(3, session.deliveriesCompleted || 6);
    const r = generateRoute(deliveries, fatigueScore);
    setRoute(r);
    setCompleted(new Set());
  };

  useEffect(() => {
    generateNewRoute();
  }, []);

  const toggleComplete = (id: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const completedCount = completed.size;
  const totalStops = route?.stops.length ?? 0;
  const progressPct = totalStops > 0 ? completedCount / totalStops : 0;

  return (
    <ScrollView
      style={[styles.container]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 12, paddingBottom: tabBarHeight + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Smart Route</Text>
          <Text style={styles.subtitle}>PSO-optimized delivery order</Text>
        </View>
        <Pressable onPress={generateNewRoute} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color={Colors.accent} />
        </Pressable>
      </View>

      {activeBreak ? (
        <BreakTimer onEnd={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          endBreak();
        }} />
      ) : (
        <View style={[
          styles.recCard,
          {
            backgroundColor: rec.urgency === "immediate" ? Colors.dangerDim :
              rec.urgency === "soon" ? Colors.cautionDim : Colors.safeDim,
            borderColor: rec.urgency === "immediate" ? Colors.danger + "40" :
              rec.urgency === "soon" ? Colors.caution + "40" : Colors.safe + "40",
          },
        ]}>
          <View style={styles.recLeft}>
            <Ionicons
              name={rec.urgency === "immediate" ? "warning" : rec.urgency === "soon" ? "time" : "checkmark-circle"}
              size={20}
              color={rec.urgency === "immediate" ? Colors.danger : rec.urgency === "soon" ? Colors.caution : Colors.safe}
            />
            <View>
              <Text style={[
                styles.recTitle,
                { color: rec.urgency === "immediate" ? Colors.danger : rec.urgency === "soon" ? Colors.caution : Colors.safe },
              ]}>
                {rec.urgency === "immediate" ? "STOP NOW" : rec.urgency === "soon" ? "BREAK SOON" : "ON TRACK"}
              </Text>
              <Text style={styles.recMessage}>{rec.message}</Text>
            </View>
          </View>
          {rec.urgency !== "low" && (
            <Pressable onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              startBreak();
            }} style={styles.recBtn}>
              <Text style={styles.recBtnText}>{rec.durationMinutes}m</Text>
            </Pressable>
          )}
        </View>
      )}

      {route && (
        <>
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Route Progress</Text>
              <Text style={styles.progressCount}>{completedCount}/{totalStops} stops</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${progressPct * 100}%` },
                ]}
              />
            </View>
            <View style={styles.routeStats}>
              <View style={styles.routeStat}>
                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.routeStatText}>{route.totalTime} min total</Text>
              </View>
              <View style={styles.routeStat}>
                <Ionicons name="cafe-outline" size={14} color={Colors.caution} />
                <Text style={styles.routeStatText}>Break after stop {route.breakAfterStop}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>DELIVERY SEQUENCE</Text>
          <View style={styles.stopsList}>
            {route.stops.map((stop, i) => (
              <StopCard
                key={stop.id}
                stop={stop}
                index={i}
                isBreakAfter={i + 1 === route.breakAfterStop}
                isCompleted={!!completed.has(stop.id)}
                onComplete={() => toggleComplete(stop.id)}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  title: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 28,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  recCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    gap: 12,
  },
  recLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 },
  recTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 2,
  },
  recMessage: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    maxWidth: 200,
  },
  recBtn: {
    backgroundColor: Colors.caution,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  recBtnText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 14,
    color: Colors.background,
  },
  breakTimerCard: {
    backgroundColor: Colors.safeDim,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.safe + "40",
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  breakTimerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  breakTimerTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
    color: Colors.safe,
    letterSpacing: 2,
  },
  breakTimerCircle: { alignItems: "center", marginBottom: 16 },
  breakTimerTime: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 52,
    color: Colors.safe,
    letterSpacing: -2,
  },
  breakTimerRemaining: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: -4,
  },
  breakProgressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 16,
  },
  breakProgressFill: {
    height: "100%",
    backgroundColor: Colors.safe,
    borderRadius: 3,
  },
  endBreakBtn: {
    backgroundColor: Colors.safe,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  endBreakText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 15,
    color: Colors.background,
    letterSpacing: 1,
  },
  progressCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  progressCount: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 16,
    color: Colors.accent,
  },
  progressTrack: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  routeStats: { flexDirection: "row", gap: 16 },
  routeStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  routeStatText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 10,
  },
  stopsList: { gap: 0 },
  stopCard: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  stopCardCompleted: { opacity: 0.5 },
  stopLeftCol: { alignItems: "center", width: 28 },
  stopCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stopLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginTop: 6,
    marginBottom: -6,
    minHeight: 20,
  },
  stopContent: { flex: 1, paddingBottom: 4 },
  stopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  stopLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  stopLabelDone: {
    textDecorationLine: "line-through",
    color: Colors.textMuted,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  riskBadgeText: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  stopMeta: { flexDirection: "row", gap: 14 },
  stopMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  stopMetaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  breakMarker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6,
    backgroundColor: Colors.cautionDim,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  breakMarkerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.caution,
  },
});
