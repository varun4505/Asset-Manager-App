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

function StatSummaryCard({ history }: { history: SessionRecord[] }) {
  if (history.length === 0) return null;

  const avgScore = history.reduce((a, b) => a + b.score, 0) / history.length;
  const highRiskCount = history.filter((h) => h.level === "high").length;
  const totalDeliveries = history.reduce((a, b) => a + b.deliveriesCompleted, 0);
  const safeRatio = Math.round(((history.length - highRiskCount) / history.length) * 100);

  const safeColor = safeRatio >= 80 ? Colors.safe : safeRatio >= 60 ? Colors.caution : Colors.danger;

  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryTitle}>SESSION OVERVIEW</Text>
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.accent }]}>{history.length}</Text>
          <Text style={styles.summaryLabel}>Total Sessions</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.safe }]}>{totalDeliveries}</Text>
          <Text style={styles.summaryLabel}>Deliveries</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: Colors.danger }]}>{highRiskCount}</Text>
          <Text style={styles.summaryLabel}>High Risk</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: safeColor }]}>{safeRatio}%</Text>
          <Text style={styles.summaryLabel}>Safe Rate</Text>
        </View>
      </View>

      <View style={styles.avgSection}>
        <Text style={styles.avgLabel}>Average Fatigue Index</Text>
        <View style={styles.avgBar}>
          <View
            style={[
              styles.avgFill,
              {
                width: `${avgScore}%`,
                backgroundColor: avgScore > 65 ? Colors.danger : avgScore > 35 ? Colors.caution : Colors.safe,
              },
            ]}
          />
        </View>
        <Text style={[
          styles.avgValue,
          { color: avgScore > 65 ? Colors.danger : avgScore > 35 ? Colors.caution : Colors.safe },
        ]}>
          {Math.round(avgScore)}
        </Text>
      </View>
    </View>
  );
}

function TrendChart({ history }: { history: SessionRecord[] }) {
  if (history.length < 2) return null;
  const recent = history.slice(0, 7).reverse();
  const maxScore = 100;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.sectionTitle}>RECENT TREND</Text>
      <View style={styles.chartArea}>
        {recent.map((s, i) => {
          const barH = Math.max(8, (s.score / maxScore) * 100);
          const color = s.level === "high" ? Colors.danger : s.level === "medium" ? Colors.caution : Colors.safe;
          return (
            <View key={s.id} style={styles.chartCol}>
              <Text style={styles.chartBarVal}>{Math.round(s.score)}</Text>
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
    </View>
  );
}

function SessionCard({ record, index }: { record: SessionRecord; index: number }) {
  const levelColor =
    record.level === "high" ? Colors.danger :
    record.level === "medium" ? Colors.caution : Colors.safe;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
      <View style={[styles.sessionCard, { borderLeftColor: levelColor, borderLeftWidth: 3 }]}>
        <View style={styles.sessionTop}>
          <View style={styles.sessionDateBlock}>
            <Text style={styles.sessionDate}>{formatDate(record.date)}</Text>
            <Text style={styles.sessionTime}>{formatTime(record.date)}</Text>
          </View>
          <View style={[styles.levelBadge, { backgroundColor: levelColor + "20", borderColor: levelColor + "50" }]}>
            <Text style={[styles.levelBadgeText, { color: levelColor }]}>{record.level.toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.sessionMetaRow}>
          <View style={styles.sessionMeta}>
            <Ionicons name="speedometer-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.sessionMetaText}>{Math.round(record.score)} index</Text>
          </View>
          <View style={styles.sessionMeta}>
            <Ionicons name="bicycle-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.sessionMetaText}>{record.deliveriesCompleted} deliveries</Text>
          </View>
          <View style={styles.sessionMeta}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.sessionMetaText}>{record.durationMinutes} min</Text>
          </View>
        </View>
        <View style={styles.sessionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Drive Hours</Text>
            <Text style={styles.detailVal}>{record.inputs.drivingHours.toFixed(1)}h</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Weather</Text>
            <Text style={styles.detailVal}>{record.inputs.weather}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailKey}>Time of Day</Text>
            <Text style={styles.detailVal}>{record.inputs.timeOfDay}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { history, clearHistory } = useFatigue();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleClear = () => {
    if (Platform.OS === "web") {
      clearHistory();
      return;
    }
    Alert.alert(
      "Clear History",
      "This will permanently delete all session records.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            clearHistory();
          },
        },
      ]
    );
  };

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
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>{history.length} sessions recorded</Text>
        </View>
        {history.length > 0 && (
          <Pressable onPress={handleClear} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </Pressable>
        )}
      </View>

      <StatSummaryCard history={history} />
      <TrendChart history={history} />

      {history.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>SESSION LOG</Text>
          {history.map((record, i) => (
            <SessionCard key={record.id} record={record} index={i} />
          ))}
        </>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="bar-chart-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Sessions Yet</Text>
          <Text style={styles.emptySubtitle}>
            Start a session from the Dashboard and end it to save your fatigue data here.
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
  },
  summaryTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 14,
  },
  summaryGrid: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 10,
    paddingVertical: 10,
  },
  summaryValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 24,
    letterSpacing: -0.5,
  },
  summaryLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  avgSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avgLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    width: 110,
  },
  avgBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  avgFill: {
    height: "100%",
    borderRadius: 4,
  },
  avgValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 16,
    width: 30,
    textAlign: "right",
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
    marginBottom: 16,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 130,
  },
  chartCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
    gap: 4,
  },
  chartBarVal: {
    fontFamily: "Rajdhani_500Medium",
    fontSize: 10,
    color: Colors.textMuted,
  },
  chartBarContainer: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  chartBar: {
    width: "80%",
    borderRadius: 4,
    minHeight: 8,
  },
  chartBarLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
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
  sessionDateBlock: {},
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
  levelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  levelBadgeText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 1,
  },
  sessionMetaRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 10,
  },
  sessionMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sessionMetaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sessionDetails: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    gap: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailKey: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  detailVal: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    textTransform: "capitalize",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
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
});
