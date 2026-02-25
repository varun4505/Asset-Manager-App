import React, { useEffect, useRef } from "react";
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
  useAnimatedProps,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, G } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import Colors from "@/constants/colors";
import { useFatigue } from "@/context/FatigueContext";
import { getBreakRecommendation, predictTimeToNextLevel, SAFETY_TIPS } from "@/lib/fatigueEngine";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const GAUGE_R = 88;
const GAUGE_CX = 110;
const GAUGE_CY = 110;
const CIRCUMFERENCE = 2 * Math.PI * GAUGE_R;
const ARC_LENGTH = CIRCUMFERENCE * 0.75;
const GAP = CIRCUMFERENCE - ARC_LENGTH;

function ArcGauge({ score, level }: { score: number; level: string }) {
  const dashOffset = useSharedValue(ARC_LENGTH);
  const glowOpacity = useSharedValue(0.5);

  const levelColor =
    level === "high" ? Colors.danger : level === "medium" ? Colors.caution : Colors.safe;

  useEffect(() => {
    const targetDash = ARC_LENGTH - (score / 100) * ARC_LENGTH;
    dashOffset.value = withSpring(targetDash, { damping: 22, stiffness: 70 });

    if (level === "high") {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 700, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      glowOpacity.value = withTiming(0.5, { duration: 400 });
    }
  }, [score, level]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.gaugeWrapper}>
      <Animated.View
        style={[
          styles.gaugePulse,
          { backgroundColor: levelColor, borderRadius: 110 },
          glowStyle,
        ]}
      />
      <Svg width={220} height={200} viewBox="0 0 220 200">
        <G
          origin={`${GAUGE_CX}, ${GAUGE_CY}`}
          rotation={135}
        >
          {/* Background track */}
          <Circle
            cx={GAUGE_CX}
            cy={GAUGE_CY}
            r={GAUGE_R}
            fill="none"
            stroke={Colors.backgroundElevated}
            strokeWidth={14}
            strokeDasharray={`${ARC_LENGTH} ${GAP}`}
            strokeLinecap="round"
          />
          {/* Colored fill */}
          <AnimatedCircle
            cx={GAUGE_CX}
            cy={GAUGE_CY}
            r={GAUGE_R}
            fill="none"
            stroke={levelColor}
            strokeWidth={14}
            strokeDasharray={`${ARC_LENGTH} ${GAP}`}
            strokeLinecap="round"
            animatedProps={animatedProps}
          />
        </G>
      </Svg>

      {/* Center text overlay */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.gaugeCenterText}>
          <Text style={[styles.gaugeScore, { color: levelColor }]}>
            {Math.round(score)}
          </Text>
          <Text style={styles.gaugeScoreLabel}>FATIGUE INDEX</Text>
          <View
            style={[
              styles.levelBadge,
              {
                backgroundColor: levelColor + "20",
                borderColor: levelColor + "50",
              },
            ]}
          >
            <Text style={[styles.levelText, { color: levelColor }]}>
              {level.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function LiveTimer({ seconds }: { seconds: number }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return (
    <Text style={styles.liveTimer}>
      {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:
      {String(s).padStart(2, "0")}
    </Text>
  );
}

function QuickActions() {
  const { isSessionActive, incrementDelivery, startBreak, endBreak, activeBreak, startSession, endSession, saveSession } = useFatigue();

  const handleDelivery = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    incrementDelivery();
  };
  const handleBreak = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (activeBreak) endBreak();
    else startBreak();
  };
  const handleSession = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (isSessionActive) {
      await saveSession();
      endSession();
    } else {
      startSession();
    }
  };

  return (
    <View style={styles.quickActions}>
      <Pressable
        onPress={handleDelivery}
        disabled={!isSessionActive}
        style={({ pressed }) => [
          styles.quickBtn,
          { backgroundColor: Colors.safe + "15", borderColor: Colors.safe + "40" },
          pressed && { opacity: 0.7 },
          !isSessionActive && { opacity: 0.35 },
        ]}
      >
        <Ionicons name="add-circle" size={22} color={Colors.safe} />
        <Text style={[styles.quickBtnText, { color: Colors.safe }]}>Delivery</Text>
        <Text style={styles.quickBtnSub}>Log Stop</Text>
      </Pressable>

      <Pressable
        onPress={handleBreak}
        disabled={!isSessionActive}
        style={({ pressed }) => [
          styles.quickBtn,
          {
            backgroundColor: activeBreak ? Colors.safe + "15" : Colors.caution + "15",
            borderColor: activeBreak ? Colors.safe + "40" : Colors.caution + "40",
          },
          pressed && { opacity: 0.7 },
          !isSessionActive && { opacity: 0.35 },
        ]}
      >
        <Ionicons
          name={activeBreak ? "cafe" : "pause-circle"}
          size={22}
          color={activeBreak ? Colors.safe : Colors.caution}
        />
        <Text
          style={[
            styles.quickBtnText,
            { color: activeBreak ? Colors.safe : Colors.caution },
          ]}
        >
          {activeBreak ? "End Break" : "Break"}
        </Text>
        <Text style={styles.quickBtnSub}>
          {activeBreak ? "Back to route" : "Rest now"}
        </Text>
      </Pressable>

      <Pressable
        onPress={handleSession}
        style={({ pressed }) => [
          styles.quickBtn,
          {
            backgroundColor: isSessionActive
              ? Colors.danger + "15"
              : Colors.accent + "15",
            borderColor: isSessionActive
              ? Colors.danger + "40"
              : Colors.accent + "40",
          },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Ionicons
          name={isSessionActive ? "stop-circle" : "play-circle"}
          size={22}
          color={isSessionActive ? Colors.danger : Colors.accent}
        />
        <Text
          style={[
            styles.quickBtnText,
            { color: isSessionActive ? Colors.danger : Colors.accent },
          ]}
        >
          {isSessionActive ? "End" : "Start"}
        </Text>
        <Text style={styles.quickBtnSub}>Session</Text>
      </Pressable>
    </View>
  );
}

function PredictionCard({ score, level, session }: { score: number; level: string; session: any }) {
  const prediction = predictTimeToNextLevel(session);

  if (level === "high") {
    return (
      <View style={[styles.predCard, { borderColor: Colors.danger + "40", backgroundColor: Colors.dangerDim }]}>
        <Ionicons name="warning" size={16} color={Colors.danger} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.predTitle, { color: Colors.danger }]}>HIGH FATIGUE ACTIVE</Text>
          <Text style={styles.predBody}>Immediate rest required. Continuing is dangerous.</Text>
        </View>
      </View>
    );
  }

  if (!prediction.minutesRemaining) {
    return (
      <View style={[styles.predCard, { borderColor: Colors.safe + "40", backgroundColor: Colors.safeDim }]}>
        <Ionicons name="shield-checkmark" size={16} color={Colors.safe} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.predTitle, { color: Colors.safe }]}>SAFE TO CONTINUE</Text>
          <Text style={styles.predBody}>No significant fatigue risk in the next 3 hours at this rate.</Text>
        </View>
      </View>
    );
  }

  const color = prediction.minutesRemaining < 30 ? Colors.danger : prediction.minutesRemaining < 60 ? Colors.caution : Colors.accent;
  return (
    <View style={[styles.predCard, { borderColor: color + "40", backgroundColor: color + "12" }]}>
      <Ionicons name="trending-up" size={16} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.predTitle, { color }]}>
          {prediction.nextLevel.toUpperCase()} RISK IN ~{prediction.minutesRemaining} MIN
        </Text>
        <Text style={styles.predBody}>
          At current pace, fatigue will escalate to {prediction.nextLevel} level. Consider a break soon.
        </Text>
      </View>
    </View>
  );
}

function BreakdownBar({ label, value, color }: { label: string; value: number; color: string }) {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(Math.min(value, 100), {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [value]);
  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <View style={styles.breakdownTrack}>
        <Animated.View
          style={[styles.breakdownFill, { backgroundColor: color }, barStyle]}
        />
      </View>
      <Text style={[styles.breakdownValue, { color }]}>{Math.round(value)}%</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const {
    fatigueScore,
    fatigueLevel,
    breakdown,
    session,
    isSessionActive,
    sessionElapsedSeconds,
    activeBreak,
    safetyScore,
    currentStreak,
    profile,
  } = useFatigue();

  const levelColor =
    fatigueLevel === "high"
      ? Colors.danger
      : fatigueLevel === "medium"
      ? Colors.caution
      : Colors.safe;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const tip = SAFETY_TIPS[fatigueLevel][Math.floor(Date.now() / 30000) % 5];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 12, paddingBottom: tabBarHeight + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>SAFEROUTE AI</Text>
          <Text style={styles.subtitle}>
            {profile.name ? `Hello, ${profile.name}` : "Fatigue Monitoring System"}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/profile")}
          style={styles.profileBtn}
        >
          <Ionicons name="person-circle-outline" size={28} color={Colors.accent} />
        </Pressable>
      </View>

      {/* Session bar */}
      {isSessionActive && (
        <View style={styles.sessionBar}>
          <View style={styles.sessionBarLeft}>
            <View style={[styles.sessionDot, { backgroundColor: activeBreak ? Colors.caution : Colors.safe }]} />
            <Text style={styles.sessionBarLabel}>
              {activeBreak ? "ON BREAK" : "SESSION ACTIVE"}
            </Text>
          </View>
          <LiveTimer seconds={sessionElapsedSeconds} />
        </View>
      )}

      {/* Arc gauge */}
      <ArcGauge score={fatigueScore} level={fatigueLevel} />

      {/* Prediction */}
      <PredictionCard score={fatigueScore} level={fatigueLevel} session={session} />

      {/* Quick actions */}
      <QuickActions />

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard
          icon="speedometer-outline"
          label="Drive Time"
          value={`${session.drivingHours.toFixed(1)}h`}
          color={Colors.accent}
        />
        <StatCard
          icon="bicycle-outline"
          label="Deliveries"
          value={`${session.deliveriesCompleted}`}
          color={Colors.safe}
        />
        <StatCard
          icon="cafe-outline"
          label="Since Break"
          value={`${session.minutesSinceBreak}m`}
          color={Colors.caution}
        />
      </View>

      {/* Safety score + streak */}
      <View style={styles.scoreRow}>
        <View style={[styles.scoreCard, { borderColor: Colors.accent + "30" }]}>
          <Text style={styles.scoreCardLabel}>SAFETY SCORE</Text>
          <Text style={[styles.scoreCardValue, { color: safetyScore >= 70 ? Colors.safe : safetyScore >= 40 ? Colors.caution : Colors.danger }]}>
            {safetyScore}
          </Text>
          <Text style={styles.scoreCardSub}>out of 100</Text>
        </View>
        <View style={[styles.scoreCard, { borderColor: Colors.caution + "30" }]}>
          <Text style={styles.scoreCardLabel}>SAFE STREAK</Text>
          <Text style={[styles.scoreCardValue, { color: Colors.caution }]}>
            {currentStreak}
          </Text>
          <Text style={styles.scoreCardSub}>sessions</Text>
        </View>
      </View>

      {/* Tip of the moment */}
      <Pressable
        onPress={() => router.push("/tips")}
        style={styles.tipCard}
      >
        <View style={styles.tipLeft}>
          <Ionicons name="bulb-outline" size={18} color={levelColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tipTitle, { color: levelColor }]}>SAFETY TIP</Text>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </Pressable>

      {/* Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FATIGUE BREAKDOWN</Text>
        <View style={styles.breakdownCard}>
          <BreakdownBar
            label="Drive Hours"
            value={breakdown.drivingHours ?? 0}
            color={Colors.accent}
          />
          <BreakdownBar
            label="Deliveries"
            value={breakdown.deliveries ?? 0}
            color={Colors.safe}
          />
          <BreakdownBar
            label="Break Overdue"
            value={breakdown.breakOverdue ?? 0}
            color={Colors.caution}
          />
          <BreakdownBar
            label="Weather"
            value={breakdown.weather ?? 0}
            color={Colors.danger}
          />
          <BreakdownBar
            label="Time of Day"
            value={breakdown.timeOfDay ?? 0}
            color="#BB86FC"
          />
          <BreakdownBar
            label="Hunger"
            value={breakdown.hunger ?? 0}
            color="#FF8A65"
          />
        </View>
      </View>

      {/* Risk guide */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RISK LEVEL GUIDE</Text>
        <View style={styles.riskCard}>
          {[
            {
              range: "0–35",
              level: "LOW",
              color: Colors.safe,
              desc: "Performing well. Stay hydrated.",
            },
            {
              range: "36–65",
              level: "MEDIUM",
              color: Colors.caution,
              desc: "Take a break soon. Reduce speed.",
            },
            {
              range: "66–100",
              level: "HIGH",
              color: Colors.danger,
              desc: "Stop immediately. High accident risk.",
            },
          ].map((item) => (
            <View key={item.level} style={styles.riskRow}>
              <View
                style={[styles.riskDot, { backgroundColor: item.color }]}
              />
              <View style={styles.riskContent}>
                <View style={styles.riskHeader}>
                  <Text style={[styles.riskLevel, { color: item.color }]}>
                    {item.level}
                  </Text>
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

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
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
    marginBottom: 16,
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
  profileBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.backgroundCard,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  sessionBarLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionBarLabel: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  liveTimer: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 1,
  },
  gaugeWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    height: 200,
  },
  gaugePulse: {
    position: "absolute",
    width: 180,
    height: 180,
    opacity: 0.05,
  },
  gaugeCenterText: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 20,
  },
  gaugeScore: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 62,
    lineHeight: 70,
    letterSpacing: -2,
  },
  gaugeScoreLabel: {
    fontFamily: "Rajdhani_500Medium",
    fontSize: 10,
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
  predCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  predTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  predBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  quickBtnText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  quickBtnSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    gap: 4,
  },
  statValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 20,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
  },
  scoreRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 2,
  },
  scoreCardLabel: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  scoreCardValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 36,
    letterSpacing: -1,
  },
  scoreCardSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  tipLeft: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  tipTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 3,
  },
  tipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 11,
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
  breakdownFill: { height: "100%", borderRadius: 3 },
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
  riskHeader: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 2,
  },
  riskLevel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
    letterSpacing: 1,
  },
  riskRange: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  riskDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
});
