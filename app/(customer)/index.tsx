import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Colors from "@/constants/colors";

export default function CustomerHome() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Customer Module</Text>
      <Text style={styles.subtitle}>Customer flow placeholder. Driver safety module is active.</Text>
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
  },
});

