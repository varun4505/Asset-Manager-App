import React, { useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolateColor,
  Easing,
} from "react-native-reanimated";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useFatigue } from "@/context/FatigueContext";
import { getBreakRecommendation } from "@/lib/fatigueEngine";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

const GAUGE_SIZE = 220;
const STROKE_WIDTH = 16;

function FatigueGauge({ score, level }: { score: number; level: string }) {
  const progress = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.6);

  const levelColor =
    level === "high" ? Colors.danger : level === "medium" ? Colors.caution : Colors.safe;

  useEffect(() => {
    progress.value = withSpring(score / 100, { damping: 18, stiffness: 80 });
    if (level === "high") {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.3, { duration: 600 })
        ),
        -1
      );
    } else {
      pulseOpacity.value = withTiming(0.6, { duration: 300 });
    }
  }, [score, level]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const circumference = 2 * Math.PI * (GAUGE_SIZE / 2 - STROKE_WIDTH);
  const dashOffset = circumference * (1 - (score / 100) * 0.75);

  return (
    <View style={styles.gaugeContainer}>
      <Animated.View
        style={[
          styles.gaugePulse,
          {
            width: GAUGE_SIZE + 40,
            height: GAUGE_SIZE + 40,
            borderRadius: (GAUGE_SIZE + 40) / 2,
            backgroundColor: levelColor,
          },
          glowStyle,
        ]}
      />
      <View style={[styles.gaugeCircle, { width: GAUGE_SIZE, height: GAUGE_SIZE, borderRadius: GAUGE_SIZE / 2 }]}>
        <View style={[styles.gaugeBorder, { borderColor: levelColor + "30" }]} />
        <View style={styles.gaugeCenter}>
          <Text style={[styles.gaugeScore, { color: levelColor }]}>
            {Math.round(score)}
          </Text>
          <Text style={styles.gaugeScoreLabel}>FATIGUE INDEX</Text>
          <View style={[styles.levelBadge, { backgroundColor: levelColor + "20", borderColor: levelColor + "60" }]}>
            <Text style={[styles.levelText, { color: levelColor }]}>
              {level.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function BreakdownBar({ label, value, color }: { label: string; value: number; color: string }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.min(value, 100), { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [value]);
  const barStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <View style={styles.breakdownTrack}>
        <Animated.View style={[styles.breakdownFill, { backgroundColor: color }, barStyle]} />
      </View>
      <Text style={[styles.breakdownValue, { color }]}>{Math.round(value)}%</Text>
    </View>
  );
}

function AlertCard({ score, level, minutesSinceBreak }: { score: number; level: string; minutesSinceBreak: number }) {
  const rec = getBreakRecommendation(score, level as any, minutesSinceBreak);
  const { startBreak, activeBreak } = useFatigue();

  const urgencyColor =
    rec.urgency === "immediate" ? Colors.danger :
    rec.urgency === "soon" ? Colors.caution : Colors.safe;

  const handleBreak = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startBreak();
  };

  if (activeBreak) {
    return (
      <View style={[styles.alertCard, { borderColor: Colors.safe + "40", backgroundColor: Colors.safeDim }]}>
        <Ionicons name="cafe" size={20} color={Colors.safe} />
        <Text style={[styles.alertText, { color: Colors.safe }]}>Break in progress — rest well</Text>
      </View>
    );
  }

  return (
    <View style={[styles.alertCard, { borderColor: urgencyColor + "40", backgroundColor: urgencyColor + "12" }]}>
      <Ionicons
        name={rec.urgency === "immediate" ? "warning" : rec.urgency === "soon" ? "time" : "checkmark-circle"}
        size={18}
        color={urgencyColor}
      />
      <Text style={[styles.alertText, { color: urgencyColor, flex: 1 }]}>{rec.message}</Text>
      {rec.urgency !== "low" && (
        <Pressable onPress={handleBreak} style={[styles.alertButton, { backgroundColor: urgencyColor }]}>
          <Text style={styles.alertButtonText}>Break</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { fatigueScore, fatigueLevel, breakdown, session, isSessionActive, startSession, endSession, saveSession } = useFatigue();

  const levelColor =
    fatigueLevel === "high" ? Colors.danger : fatigueLevel === "medium" ? Colors.caution : Colors.safe;

  const handleSessionToggle = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (isSessionActive) {
      await saveSession();
      endSession();
    } else {
      startSession();
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 12, paddingBottom: tabBarHeight + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>SAFEROUTE AI</Text>
          <Text style={styles.subtitle}>Fatigue Monitoring Active</Text>
        </View>
        <Pressable
          onPress={handleSessionToggle}
          style={[
            styles.sessionBtn,
            {
              backgroundColor: isSessionActive
                ? Colors.danger + "20"
                : Colors.accent + "20",
              borderColor: isSessionActive ? Colors.danger + "60" : Colors.accent + "60",
            },
          ]}
        >
          <Ionicons
            name={isSessionActive ? "stop-circle" : "play-circle"}
            size={18}
            color={isSessionActive ? Colors.danger : Colors.accent}
          />
          <Text
            style={[
              styles.sessionBtnText,
              { color: isSessionActive ? Colors.danger : Colors.accent },
            ]}
          >
            {isSessionActive ? "End" : "Start"}
          </Text>
        </Pressable>
      </View>

      <FatigueGauge score={fatigueScore} level={fatigueLevel} />

      <AlertCard
        score={fatigueScore}
        level={fatigueLevel}
        minutesSinceBreak={session.minutesSinceBreak}
      />

      <View style={styles.statsRow}>
        <StatCard icon="time-outline" label="Drive Time" value={`${session.drivingHours.toFixed(1)}h`} color={Colors.accent} />
        <StatCard icon="bicycle-outline" label="Deliveries" value={`${session.deliveriesCompleted}`} color={Colors.safe} />
        <StatCard icon="café-outline" label="Since Break" value={`${session.minutesSinceBreak}m`} color={Colors.caution} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FATIGUE BREAKDOWN</Text>
        <View style={styles.breakdownCard}>
          <BreakdownBar label="Drive Hours" value={breakdown.drivingHours ?? 0} color={Colors.accent} />
          <BreakdownBar label="Deliveries" value={breakdown.deliveries ?? 0} color={Colors.safe} />
          <BreakdownBar label="Break Overdue" value={breakdown.breakOverdue ?? 0} color={Colors.caution} />
          <BreakdownBar label="Weather" value={breakdown.weather ?? 0} color={Colors.danger} />
          <BreakdownBar label="Time of Day" value={breakdown.timeOfDay ?? 0} color="#BB86FC" />
          <BreakdownBar label="Hunger" value={breakdown.hunger ?? 0} color="#FF8A65" />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RISK LEVEL GUIDE</Text>
        <View style={styles.riskCard}>
          {[
            { range: "0–35", level: "LOW", color: Colors.safe, desc: "Performing well. Stay hydrated." },
            { range: "36–65", level: "MEDIUM", color: Colors.caution, desc: "Take a break soon. Reduce speed." },
            { range: "66–100", level: "HIGH", color: Colors.danger, desc: "Stop immediately. High accident risk." },
          ].map((item) => (
            <View key={item.level} style={styles.riskRow}>
              <View style={[styles.riskDot, { backgroundColor: item.color }]} />
              <View style={styles.riskContent}>
                <View style={styles.riskHeader}>
                  <Text style={[styles.riskLevel, { color: item.color }]}>{item.level}</Text>
                  <Text style={styles.riskRange}>{item.range}</Text>
                </View>
                <Text style={styles.riskDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + "30" }]}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  appName: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 3,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sessionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  sessionBtnText: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  gaugeContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  gaugePulse: {
    position: "absolute",
    opacity: 0.06,
  },
  gaugeCircle: {
    backgroundColor: Colors.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  gaugeBorder: {
    position: "absolute",
    inset: 0,
    borderRadius: GAUGE_SIZE / 2,
    borderWidth: 2,
  },
  gaugeCenter: { alignItems: "center" },
  gaugeScore: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 64,
    lineHeight: 72,
    letterSpacing: -2,
  },
  gaugeScoreLabel: {
    fontFamily: "Rajdhani_500Medium",
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginTop: -4,
  },
  levelBadge: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  levelText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
    letterSpacing: 2,
  },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  alertText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
  },
  alertButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  alertButtonText: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 12,
    color: "#fff",
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    gap: 4,
  },
  statValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 22,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 2,
    marginBottom: 10,
  },
  breakdownCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  breakdownLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    width: 90,
  },
  breakdownTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  breakdownFill: {
    height: "100%",
    borderRadius: 3,
  },
  breakdownValue: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 13,
    width: 36,
    textAlign: "right",
  },
  riskCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  riskRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  riskDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  riskContent: { flex: 1 },
  riskHeader: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 2 },
  riskLevel: { fontFamily: "Rajdhani_700Bold", fontSize: 13, letterSpacing: 1 },
  riskRange: { fontFamily: "Inter_400Regular", fontSize: 11, color: Colors.textMuted },
  riskDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
});
