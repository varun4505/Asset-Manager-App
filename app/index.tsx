import React from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";

function RoleCard({
  title,
  subtitle,
  description,
  icon,
  color,
  onPress,
}: {
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        { borderColor: `${color}45` },
        pressed && styles.roleCardPressed,
      ]}
    >
      <View style={[styles.roleIconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.roleTextWrap}>
        <Text style={[styles.roleSubtitle, { color }]}>{subtitle}</Text>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Pressable>
  );
}

export default function RoleChooserScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 72 : insets.top + 24;
  const bottomPad = Platform.OS === "web" ? 32 : insets.bottom + 20;

  const goTo = (href: "/(tabs)" | "/(customer)" | "/(admin)") => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace(href);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <View style={styles.heroGlowPrimary} />
        <View style={styles.heroGlowSecondary} />
        <Text style={styles.heroEyebrow}>SAFEROUTE AI</Text>
        <Text style={styles.heroTitle}>Choose your role</Text>
        <Text style={styles.heroBody}>
          Select the module you want to open. Driver handles fatigue safety, Customer handles order placement and tracking, and Admin manages logistics plus soft-computing controls.
        </Text>
      </View>

      <View style={styles.section}>
        <RoleCard
          title="Driver Safety"
          subtitle="PRIMARY MODULE"
          description="Fatigue scoring, break advice, ASO route optimization, history and profile."
          icon="speedometer-outline"
          color={Colors.accent}
          onPress={() => goTo("/(tabs)")}
        />
        <RoleCard
          title="Customer"
          subtitle="LIVE MODULE"
          description="Create orders, estimate fees, track rider assignment, and view order history."
          icon="bag-handle-outline"
          color={Colors.safe}
          onPress={() => goTo("/(customer)")}
        />
        <RoleCard
          title="Admin"
          subtitle="LIVE MODULE"
          description="Manage orders, riders, zones, ASO simulations, and backend app configuration."
          icon="analytics-outline"
          color={Colors.caution}
          onPress={() => goTo("/(admin)")}
        />
      </View>

      <View style={styles.noteCard}>
        <Ionicons name="git-branch-outline" size={16} color={Colors.textMuted} />
        <Text style={styles.noteText}>
          Backend APIs are live on Vercel. The driver module is connected to deployed soft-computing endpoints with local fallback only if the API is unreachable.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: Colors.backgroundCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    marginBottom: 18,
  },
  heroGlowPrimary: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.accentGlow,
    top: -50,
    right: -40,
  },
  heroGlowSecondary: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.safeGlow,
    bottom: -40,
    left: -30,
  },
  heroEyebrow: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 34,
    color: Colors.text,
    lineHeight: 38,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  heroBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    maxWidth: 320,
  },
  section: {
    gap: 12,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: Colors.backgroundCard,
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
  },
  roleCardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.995 }],
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTextWrap: {
    flex: 1,
    gap: 3,
  },
  roleSubtitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 11,
    letterSpacing: 2,
  },
  roleTitle: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 21,
    color: Colors.text,
    lineHeight: 24,
  },
  roleDescription: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  noteCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 18,
  },
  noteText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
