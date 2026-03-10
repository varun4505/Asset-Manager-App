import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Colors from "@/constants/colors";

export default function CustomerHome() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Customer Module</Text>
      <Text style={styles.subtitle}>Customer flow placeholder. Driver safety module is active.</Text>
      <Pressable onPress={() => router.replace("/")} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={16} color={Colors.background} />
        <Text style={styles.backText}>Choose Another Role</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    padding: 24,
  },
  title: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 28,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 16,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.safe,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backText: {
    fontFamily: "Rajdhani_700Bold",
    fontSize: 15,
    color: Colors.background,
  },
});
