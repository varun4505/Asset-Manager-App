import React, { useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useFatigue } from "@/context/FatigueContext";
import { WeatherCondition, TimeOfDay } from "@/lib/fatigueEngine";

function SliderInput({
  label,
  value,
  min,
  max,
  step,
  unit,
  color,
  onChangeValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  color: string;
  onChangeValue: (v: number) => void;
}) {
  const pct = (value - min) / (max - min);

  const decrement = () => {
    const next = Math.max(min, parseFloat((value - step).toFixed(2)));
    Haptics.selectionAsync();
    onChangeValue(next);
  };
  const increment = () => {
    const next = Math.min(max, parseFloat((value + step).toFixed(2)));
    Haptics.selectionAsync();
    onChangeValue(next);
  };

  return (
    <View style={styles.sliderCard}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={[styles.sliderValue, { color }]}>
          {value.toFixed(step < 1 ? 1 : 0)}
          <Text style={styles.sliderUnit}> {unit}</Text>
        </Text>
      </View>
      <View style={styles.sliderRow}>
        <Pressable onPress={decrement} style={({ pressed }) => [styles.sliderBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="remove" size={20} color={Colors.textSecondary} />
        </Pressable>
        <View style={styles.sliderTrack}>
          <View style={[styles.sliderFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
          <View style={[styles.sliderThumb, { left: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
        <Pressable onPress={increment} style={({ pressed }) => [styles.sliderBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="add" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

function OptionPicker<T extends string>({
  label,
  options,
  selected,
  onSelect,
  getColor,
}: {
  label: string;
  options: { value: T; label: string; icon: string }[];
  selected: T;
  onSelect: (v: T) => void;
  getColor?: (v: T) => string;
}) {
  return (
    <View style={styles.optionCard}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.optionsRow}>
        {options.map((opt) => {
          const active = selected === opt.value;
          const color = getColor ? getColor(opt.value) : Colors.accent;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(opt.value);
              }}
              style={[
                styles.optionBtn,
                active && { backgroundColor: color + "20", borderColor: color + "60" },
              ]}
            >
              <Ionicons name={opt.icon as any} size={16} color={active ? color : Colors.textMuted} />
              <Text style={[styles.optionLabel, active && { color }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const weatherOptions: { value: WeatherCondition; label: string; icon: string }[] = [
  { value: "clear", label: "Clear", icon: "sunny-outline" },
  { value: "cloudy", label: "Cloudy", icon: "cloudy-outline" },
  { value: "rain", label: "Rain", icon: "rainy-outline" },
  { value: "storm", label: "Storm", icon: "thunderstorm-outline" },
];

const timeOptions: { value: TimeOfDay; label: string; icon: string }[] = [
  { value: "morning", label: "Morning", icon: "partly-sunny-outline" },
  { value: "afternoon", label: "Afternoon", icon: "sunny" },
  { value: "evening", label: "Evening", icon: "sunset-outline" },
  { value: "night", label: "Night", icon: "moon-outline" },
];

function weatherColor(w: WeatherCondition) {
  if (w === "storm") return Colors.danger;
  if (w === "rain") return Colors.caution;
  if (w === "cloudy") return Colors.textSecondary;
  return Colors.safe;
}

function HungerPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const levels = [
    { v: 1, label: "Full", icon: "happy-outline" },
    { v: 2, label: "Ok", icon: "smile" },
    { v: 3, label: "Hungry", icon: "sad-outline" },
    { v: 4, label: "Very", icon: "sad" },
    { v: 5, label: "Starving", icon: "alert-circle-outline" },
  ];
  return (
    <View style={styles.optionCard}>
      <Text style={styles.sliderLabel}>Hunger Level</Text>
      <View style={styles.optionsRow}>
        {levels.map((l) => {
          const active = value === l.v;
          const color = l.v >= 4 ? Colors.danger : l.v === 3 ? Colors.caution : Colors.safe;
          return (
            <Pressable
              key={l.v}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(l.v);
              }}
              style={[
                styles.optionBtn,
                active && { backgroundColor: color + "20", borderColor: color + "60" },
              ]}
            >
              <Ionicons name={l.icon as any} size={16} color={active ? color : Colors.textMuted} />
              <Text style={[styles.optionLabel, active && { color }]}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SessionScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { session, updateSession, fatigueLevel, isSessionActive } = useFatigue();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const levelColor =
    fatigueLevel === "high" ? Colors.danger : fatigueLevel === "medium" ? Colors.caution : Colors.safe;

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
          <Text style={styles.title}>Session Inputs</Text>
          <Text style={styles.subtitle}>Adjust your current conditions</Text>
        </View>
        <View style={[styles.levelPill, { backgroundColor: levelColor + "20", borderColor: levelColor + "50" }]}>
          <View style={[styles.levelDot, { backgroundColor: levelColor }]} />
          <Text style={[styles.levelPillText, { color: levelColor }]}>{fatigueLevel.toUpperCase()}</Text>
        </View>
      </View>

      {!isSessionActive && (
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.accent} />
          <Text style={styles.infoText}>Start a session from the Dashboard to begin tracking</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>DRIVING CONDITIONS</Text>

      <SliderInput
        label="Total Driving Hours"
        value={session.drivingHours}
        min={0}
        max={12}
        step={0.5}
        unit="hrs"
        color={Colors.accent}
        onChangeValue={(v) => updateSession({ drivingHours: v })}
      />
      <SliderInput
        label="Deliveries Completed"
        value={session.deliveriesCompleted}
        min={0}
        max={30}
        step={1}
        unit="stops"
        color={Colors.safe}
        onChangeValue={(v) => updateSession({ deliveriesCompleted: v })}
      />
      <SliderInput
        label="Minutes Since Last Break"
        value={session.minutesSinceBreak}
        min={0}
        max={240}
        step={5}
        unit="min"
        color={Colors.caution}
        onChangeValue={(v) => updateSession({ minutesSinceBreak: v })}
      />

      <Text style={[styles.sectionTitle, { marginTop: 12 }]}>ENVIRONMENT</Text>

      <OptionPicker
        label="Weather Condition"
        options={weatherOptions}
        selected={session.weather}
        onSelect={(v) => updateSession({ weather: v })}
        getColor={weatherColor}
      />
      <OptionPicker
        label="Time of Day"
        options={timeOptions}
        selected={session.timeOfDay}
        onSelect={(v) => updateSession({ timeOfDay: v })}
      />
      <HungerPicker value={session.hungerLevel} onChange={(v) => updateSession({ hungerLevel: v })} />

      <View style={styles.fuzzyNote}>
        <Ionicons name="git-branch-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.fuzzyText}>
          Powered by Fuzzy Logic Engine — inputs are processed through membership functions to compute your real-time fatigue index
        </Text>
      </View>
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
    marginBottom: 20,
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
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelPillText: { fontFamily: "Rajdhani_600SemiBold", fontSize: 12, letterSpacing: 1 },
  infoCard: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: Colors.accentGlow,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.accent + "30",
    alignItems: "flex-start",
  },
  infoText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.accent,
    flex: 1,
    lineHeight: 17,
  },
  sectionTitle: {
    fontFamily: "Rajdhani_600SemiBold",
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 10,
  },
  sliderCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sliderLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: Colors.text,
  },
  sliderValue: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 20,
  },
  sliderUnit: {
    fontFamily: "Rajdhani_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sliderBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.backgroundElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: "visible",
    position: "relative",
  },
  sliderFill: {
    height: "100%",
    borderRadius: 4,
  },
  sliderThumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    top: -4,
    marginLeft: -8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  optionCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.backgroundElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  optionLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  fuzzyNote: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 4,
    alignItems: "flex-start",
  },
  fuzzyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    flex: 1,
  },
});
