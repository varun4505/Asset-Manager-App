import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useFatigue, SessionRecord } from "@/context/FatigueContext";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function StatSummaryCard({ history, safetyScore, currentStreak }: {
  history: SessionRecord[];
  safetyScore: number;
  currentStreak: number;
}) {
  if (history.length === 0) return null;

  const avgScore = history.reduce((a, b) => a + b.score, 0) / history.length;
  const highRiskCount = history.filter((h) => h.level === "high").length;
  const totalDeliveries = history.reduce((a, b) => a + b.deliveriesCompleted, 0);
  const safeRatio = Math.round(((history.length - highRiskCount) / history.length) * 100);

  const safeColor =
    safetyScore >= 70 ? Colors.safe : safetyScore >= 40 ? Colors.caution : Colors.danger;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryTopRow}>
        {/* Safety score ring */}
        <View style={[styles.safetyRing, { borderColor: safeColor }]}>
          <Text style={[styles.safetyRingValue, { color: safeColor }]}>{safetyScore}</Text>
          <Text style={styles.safetyRingLabel}>SAFETY</Text>
        </View>
        <View style={styles.summaryRightCol}>
          <Text style={styles.summaryTitle}>PERFORMANCE OVERVIEW</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.accent }]}>{history.length}</Text>
              <Text style={styles.summaryLabel}>Sessions</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.safe }]}>{totalDeliveries}</Text>
              <Text style={styles.summaryLabel}>Deliveries</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.caution }]}>{currentStreak}</Text>
              <Text style={styles.summaryLabel}>Streak</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.danger }]}>{highRiskCount}</Text>
              <Text style={styles.summaryLabel}>High Risk</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.avgSection}>
        <Text style={styles.avgLabel}>Avg Fatigue Index</Text>
        <View style={styles.avgBar}>
          <View
            style={[
              styles.avgFill,
              {
                width: `${avgScore}%`,
                backgroundColor:
                  avgScore > 65 ? Colors.danger : avgScore > 35 ? Colors.caution : Colors.safe,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.avgValue,
            {
              color: avgScore > 65 ? Colors.danger : avgScore > 35 ? Colors.caution : Colors.safe,
            },
          ]}
        >
          {Math.round(avgScore)}
        </Text>
      </View>

      {currentStreak > 0 && (
        <View style={styles.streakBanner}>
          <Ionicons name="flame" size={16} color={Colors.caution} />
          <Text style={[styles.streakText, { color: Colors.caution }]}>
            {currentStreak} session{currentStreak !== 1 ? "s" : ""} without high fatigue
          </Text>
          <View style={styles.streakBadge}>
            <Text style={styles.streakBadgeText}>STREAK</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function TrendChart({ history }: { history: SessionRecord[] }) {
  if (history.length < 2) return null;
  const recent = history.slice(0, 7).reverse();

  return (
    <View style={styles.chartCard}>
      <Text style={styles.sectionTitle}>RECENT TREND</Text>
      <View style={styles.chartArea}>
        {recent.map((s) => {
          const barH = Math.max(10, (s.score / 100) * 100);
          const color =
            s.level === "high" ? Colors.danger : s.level === "medium" ? Colors.caution : Colors.safe;
          return (
            <View key={s.id} style={styles.chartCol}>
              <Text style={[styles.chartBarVal, { color }]}>{Math.round(s.score)}</Text>
              <View style={styles.chartBarContainer}>
                <View style={[styles.chartBar, { height: barH, backgroundColor: color }]} />
              </View>
              <Text style={styles.chartBarLabel}>
                {new Date(s.date).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2)}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.chartLegend}>
        {[
          { color: Colors.safe, label: "Low" },
          { color: Colors.caution, label: "Medium" },
          { color: Colors.danger, label: "High" },
        ].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendLabel}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function SessionCard({ record, index }: { record: SessionRecord; index: number }) {
  const levelColor =
    record.level === "high"
      ? Colors.danger
      : record.level === "medium"
      ? Colors.caution
      : Colors.safe;

  const earnings = record.earningsRate
    ? record.deliveriesCompleted * record.earningsRate
    : null;

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <View style={[styles.sessionCard, { borderLeftColor: levelColor, borderLeftWidth: 3 }]}>
        <View style={styles.sessionTop}>
          <View>
            <Text style={styles.sessionDate}>{formatDate(record.date)}</Text>
            <Text style={styles.sessionTime}>{formatTime(record.date)}</Text>
          </View>
          <View style={styles.sessionTopRight}>
            <Text style={[styles.sessionScore, { color: levelColor }]}>
              {Math.round(record.score)}
            </Text>
            <View
              style={[
                styles.levelBadge,
                { backgroundColor: levelColor + "20", borderColor: levelColor + "50" },
              ]}
            >
              <Text style={[styles.levelBadgeText, { color: levelColor }]}>
                {record.level.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.sessionMetaRow}>
          <View style={styles.sessionMeta}>
            <Ionicons name="bicycle-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.sessionMetaText}>{record.deliveriesCompleted} stops</Text>
          </View>
          <View style={styles.sessionMeta}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.sessionMetaText}>{record.durationMinutes} min</Text>
          </View>
          <View style={styles.sessionMeta}>
            <Ionicons name="sunny-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.sessionMetaText}>{record.inputs.weather}</Text>
          </View>
          {earnings !== null && (
            <View style={styles.sessionMeta}>
              <Ionicons name="cash-outline" size={13} color={Colors.safe} />
              <Text style={[styles.sessionMetaText, { color: Colors.safe }]}>
                ₹{earnings.toFixed(0)}
              </Text>
            </View>
          )}
        </View>
        {record.notes ? (
          <View style={styles.sessionNoteRow}>
            <Ionicons name="chatbubble-outline" size={11} color={Colors.accent} />
            <Text style={styles.sessionNoteText} numberOfLines={2}>{record.notes}</Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { history, clearHistory, safetyScore, currentStreak } = useFatigue();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  type FilterLevel = "all" | "low" | "medium" | "high";
  const [filter, setFilter] = useState<FilterLevel>("all");

  const filtered = filter === "all" ? history : history.filter((s) => s.level === filter);

  const FILTERS: { label: string; value: FilterLevel; color: string }[] = [
    { label: "All", value: "all", color: Colors.accent },
    { label: "Low", value: "low", color: Colors.safe },
    { label: "Medium", value: "medium", color: Colors.caution },
    { label: "High", value: "high", color: Colors.danger },
  ];

  const handleClear = () => {
    if (Platform.OS === "web") {
      clearHistory();
      return;
    }
    Alert.alert("Clear History", "This will permanently delete all session records.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete All",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          clearHistory();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 12, paddingBottom: tabBarHeight + 20 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>{history.length} sessions recorded</Text>
        </View>
        {history.length > 0 && (
          <Pressable onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </Pressable>
        )}
      </View>

      <StatSummaryCard
        history={history}
        safetyScore={safetyScore}
        currentStreak={currentStreak}
      />
      <TrendChart history={history} />

      {/* Filter tabs */}
      {history.length > 0 && (
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFilter(f.value)}
                style={[
                  styles.filterBtn,
                  active && { backgroundColor: f.color + "20", borderColor: f.color + "60" },
                ]}
              >
                <Text style={[styles.filterBtnText, { color: active ? f.color : Colors.textMuted }]}>
                  {f.label}
                  {f.value !== "all" && ` (${history.filter((s) => s.level === f.value).length})`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {filtered.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>SESSION LOG</Text>
          {filtered.map((record, i) => (
            <SessionCard key={record.id} record={record} index={i} />
          ))}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="bar-chart-outline" size={52} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>{history.length === 0 ? "No Sessions Yet" : "No matches"}</Text>
          <Text style={styles.emptySubtitle}>
            {history.length === 0
              ? "Start a session from the Dashboard and tap End to save your fatigue data here."
              : `No ${filter} fatigue sessions recorded.`}
          </Text>
        </View>
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
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.dangerDim,
    borderWidth: 1,
    borderColor: Colors.danger + "30",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    gap: 14,
  },
  summaryTopRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  safetyRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundElevated,
    flexShrink: 0,
  },
  safetyRingValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 26,
    letterSpacing: -1,
  },
  safetyRingLabel: {
    fontFamily: "Rajdhani_500Medium",
    fontSize: 8,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  summaryRightCol: { flex: 1, gap: 8 },
  summaryTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 8,
    paddingVertical: 7,
  },
  summaryValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 20,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: "center",
  },
  avgSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avgLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textSecondary,
    width: 100,
  },
  avgBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  avgFill: { height: "100%", borderRadius: 3 },
  avgValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 14,
    width: 28,
    textAlign: "right",
  },
  streakBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.cautionDim,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.caution + "30",
  },
  streakText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    flex: 1,
  },
  streakBadge: {
    backgroundColor: Colors.caution,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  streakBadgeText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 9,
    color: Colors.background,
    letterSpacing: 1,
  },
  chartCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 12,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 120,
    marginBottom: 12,
  },
  chartCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
    gap: 4,
  },
  chartBarVal: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 10,
  },
  chartBarContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  chartBar: { width: "80%", borderRadius: 4, minHeight: 10 },
  chartBarLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
  },
  chartLegend: {
    flexDirection: "row",
    gap: 14,
    justifyContent: "center",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
  },
  sessionCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sessionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  sessionDate: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
  },
  sessionTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  sessionTopRight: { alignItems: "flex-end", gap: 4 },
  sessionScore: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 28,
    letterSpacing: -1,
  },
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  levelBadgeText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 10,
    letterSpacing: 1,
  },
  sessionMetaRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  sessionMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  sessionMetaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "capitalize",
  },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 20,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
  sessionNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 8,
    backgroundColor: Colors.accentGlow ?? Colors.backgroundElevated,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  sessionNoteText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnText: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.5,
  },
});

