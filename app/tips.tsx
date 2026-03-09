import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFatigue } from "@/context/FatigueContext";
import { defaultAppConfig, resolveThemeColor, useAppConfig } from "@/lib/app-config";
import { type FatigueLevel } from "@shared/soft-config";

const LEVEL_CONFIG: Record<FatigueLevel, { color: string; icon: string; label: string; description: string }> = {
  low: {
    color: Colors.safe,
    icon: "shield-checkmark",
    label: "LOW FATIGUE",
    description: "You are alert and performing well. Keep it up with these habits.",
  },
  medium: {
    color: Colors.caution,
    icon: "time",
    label: "MEDIUM FATIGUE",
    description: "Fatigue is building. Follow these tips to prevent escalation.",
  },
  high: {
    color: Colors.danger,
    icon: "warning",
    label: "HIGH FATIGUE",
    description: "Fatigue is at a dangerous level. Your safety is the priority.",
  },
};

export default function TipsScreen() {
  const insets = useSafeAreaInsets();
  const { fatigueLevel } = useFatigue();
  const { data: appConfig = defaultAppConfig } = useAppConfig();

  const config = LEVEL_CONFIG[fatigueLevel];
  const tips: string[] =
    appConfig.safetyTips[fatigueLevel] ??
    defaultAppConfig.safetyTips[fatigueLevel] ??
    [];
  const generalTips = appConfig.generalTips;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.levelBanner,
          { backgroundColor: config.color + "15", borderColor: config.color + "40" },
        ]}
      >
        <Ionicons name={config.icon as any} size={28} color={config.color} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.levelLabel, { color: config.color }]}>{config.label}</Text>
          <Text style={styles.levelDesc}>{config.description}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>TIPS FOR YOUR CURRENT STATE</Text>
      <View style={styles.tipsCard}>
        {tips.map((tip, i) => (
          <View key={i} style={[styles.tipRow, i < tips.length - 1 && styles.tipRowBorder]}>
            <View style={[styles.tipNumber, { backgroundColor: config.color + "20" }]}>
              <Text style={[styles.tipNumberText, { color: config.color }]}>{i + 1}</Text>
            </View>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>GENERAL DRIVING SAFETY</Text>
      <View style={styles.generalGrid}>
        {generalTips.map((tip, i) => {
          const color = resolveThemeColor(tip.color);
          return (
            <View key={i} style={[styles.generalCard, { borderLeftColor: color }]}>
              <View style={styles.generalHeader}>
                <View
                  style={[
                    styles.generalIconWrap,
                    { backgroundColor: color + "15" },
                  ]}
                >
                  <Ionicons name={tip.icon as any} size={16} color={color} />
                </View>
                <Text style={[styles.generalTitle, { color }]}>{tip.title}</Text>
              </View>
              <Text style={styles.generalBody}>{tip.body}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.engineNote}>
        <Ionicons name="git-branch-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.engineNoteText}>
          Tips are prioritized from backend configuration and current fatigue risk.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  levelBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  levelLabel: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 4,
  },
  levelDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  sectionTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 10,
  },
  tipsCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: 20,
  },
  tipRow: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    alignItems: "flex-start",
  },
  tipRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tipNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tipNumberText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 13,
  },
  tipText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
    flex: 1,
  },
  generalGrid: { gap: 10, marginBottom: 16 },
  generalCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    gap: 8,
  },
  generalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  generalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  generalTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  generalBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  engineNote: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 4,
  },
  engineNoteText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
});
