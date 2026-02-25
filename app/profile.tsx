import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useFatigue } from "@/context/FatigueContext";

const VEHICLES = [
  { label: "Motorcycle", icon: "motorbike" },
  { label: "Bicycle", icon: "bicycle" },
  { label: "Car", icon: "car-side" },
  { label: "Van", icon: "van-utility" },
  { label: "Scooter", icon: "scooter" },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, updateProfile, safetyScore, currentStreak, history } = useFatigue();

  const [name, setName] = useState(profile.name);
  const [company, setCompany] = useState(profile.company);
  const [goal, setGoal] = useState(String(profile.dailyGoal));
  const [vehicle, setVehicle] = useState(profile.vehicle);
  const [saved, setSaved] = useState(false);

  const totalDeliveries = history.reduce((a, b) => a + b.deliveriesCompleted, 0);
  const totalSessions = history.length;
  const avgScore = totalSessions > 0
    ? Math.round(history.reduce((a, b) => a + b.score, 0) / totalSessions)
    : 0;

  const safeColor =
    safetyScore >= 70 ? Colors.safe : safetyScore >= 40 ? Colors.caution : Colors.danger;

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateProfile({
      name: name.trim(),
      company: company.trim(),
      dailyGoal: parseInt(goal) || 20,
      vehicle,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Stats overview */}
      <View style={styles.statsCard}>
        <Text style={styles.sectionTitle}>YOUR STATS</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: safeColor }]}>{safetyScore}</Text>
            <Text style={styles.statLabel}>Safety Score</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.caution }]}>{currentStreak}</Text>
            <Text style={styles.statLabel}>Safe Streak</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.accent }]}>{totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.safe }]}>{totalDeliveries}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
        </View>
      </View>

      {/* Safety score ring */}
      <View style={styles.scoreRingCard}>
        <View style={[styles.scoreRing, { borderColor: safeColor }]}>
          <Text style={[styles.scoreRingValue, { color: safeColor }]}>{safetyScore}</Text>
          <Text style={styles.scoreRingLabel}>SAFETY</Text>
        </View>
        <View style={styles.scoreDesc}>
          <Text style={styles.scoreDescTitle}>
            {safetyScore >= 70 ? "Excellent Driver" : safetyScore >= 40 ? "Improving" : "Needs Attention"}
          </Text>
          <Text style={styles.scoreDescText}>
            Based on your last {Math.min(10, totalSessions)} sessions. Average fatigue index: {avgScore}.
          </Text>
          <View style={styles.scoreBar}>
            <View style={[styles.scoreBarFill, { width: `${safetyScore}%`, backgroundColor: safeColor }]} />
          </View>
        </View>
      </View>

      {/* Profile form */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>DRIVER DETAILS</Text>

      <View style={styles.formCard}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Driver Name</Text>
          <View style={styles.inputRow}>
            <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
              returnKeyType="next"
            />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Company / Fleet</Text>
          <View style={styles.inputRow}>
            <Ionicons name="business-outline" size={16} color={Colors.textMuted} />
            <TextInput
              value={company}
              onChangeText={setCompany}
              placeholder="e.g. Zomato, Amazon"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
              returnKeyType="next"
            />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Daily Delivery Goal</Text>
          <View style={styles.inputRow}>
            <Ionicons name="flag-outline" size={16} color={Colors.textMuted} />
            <TextInput
              value={goal}
              onChangeText={setGoal}
              placeholder="20"
              placeholderTextColor={Colors.textMuted}
              style={styles.textInput}
              keyboardType="numeric"
              returnKeyType="done"
            />
            <Text style={styles.inputSuffix}>deliveries</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>VEHICLE TYPE</Text>
      <View style={styles.vehicleGrid}>
        {VEHICLES.map((v) => {
          const active = vehicle === v.label;
          return (
            <Pressable
              key={v.label}
              onPress={() => {
                Haptics.selectionAsync();
                setVehicle(v.label);
              }}
              style={[
                styles.vehicleBtn,
                active && {
                  backgroundColor: Colors.accent + "20",
                  borderColor: Colors.accent + "60",
                },
              ]}
            >
              <MaterialCommunityIcons
                name={v.icon as any}
                size={24}
                color={active ? Colors.accent : Colors.textMuted}
              />
              <Text style={[styles.vehicleLabel, active && { color: Colors.accent }]}>
                {v.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={handleSave} style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}>
        <Ionicons name={saved ? "checkmark-circle" : "save-outline"} size={18} color={Colors.background} />
        <Text style={styles.saveBtnText}>{saved ? "Saved!" : "Save Profile"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  sectionTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 10,
  },
  statsCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 2,
  },
  statValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 24,
  },
  statLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
  },
  scoreRingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  scoreRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.backgroundElevated,
  },
  scoreRingValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 28,
    letterSpacing: -1,
  },
  scoreRingLabel: {
    fontFamily: "Rajdhani_500Medium",
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  scoreDesc: { flex: 1, gap: 4 },
  scoreDescTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 16,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  scoreDescText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  scoreBar: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 4,
  },
  scoreBarFill: { height: "100%", borderRadius: 2 },
  formCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    overflow: "hidden",
  },
  inputGroup: { padding: 16 },
  inputLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
    color: Colors.text,
  },
  inputSuffix: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  vehicleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  vehicleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.backgroundCard,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vehicleLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textMuted,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
  },
  saveBtnText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 16,
    color: Colors.background,
    letterSpacing: 1,
  },
});
