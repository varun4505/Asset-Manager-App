import React from "react";
import { View, Text, StyleSheet, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Colors from "@/constants/colors";
import { useFatigue } from "@/context/FatigueContext";

export default function EarningsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { history } = useFatigue();

  const totalEarnings = history.reduce((sum, record) => {
    if (!record.earningsRate) return sum;
    return sum + record.earningsRate * record.deliveriesCompleted;
  }, 0);

  const sessionsWithRate = history.filter((record) => !!record.earningsRate).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 12, paddingBottom: tabBarHeight + 20 },
      ]}
    >
      <Text style={styles.title}>Earnings</Text>
      <Text style={styles.subtitle}>Session earnings summary</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Total Logged Earnings</Text>
        <Text style={styles.value}>Rs {totalEarnings.toFixed(0)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Sessions With Earnings Data</Text>
        <Text style={styles.value}>{sessionsWithRate}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  title: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 28,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  value: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 34,
    color: Colors.accent,
  },
});

