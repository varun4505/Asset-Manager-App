import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import Colors from "@/constants/colors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "gauge.medium", selected: "gauge.high" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="session">
        <Icon sf={{ default: "timer", selected: "timer.fill" }} />
        <Label>Session</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="routes">
        <Icon sf={{ default: "map", selected: "map.fill" }} />
        <Label>Routes</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
        <Label>History</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="earnings">
        <Icon sf={{ default: "banknote", selected: "banknote.fill" }} />
        <Label>Earnings</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="deliveries">
        <Icon sf={{ default: "bicycle", selected: "bicycle.circle.fill" }} />
        <Label>Deliveries</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function TabIcon({
  name,
  focused,
  library = "ionicons",
}: {
  name: string;
  focused: boolean;
  library?: "ionicons" | "material";
}) {
  const color = focused ? Colors.accent : Colors.tabInactive;
  const size = 24;
  if (library === "material") {
    return (
      <MaterialCommunityIcons name={name as any} size={size} color={color} />
    );
  }
  return <Ionicons name={name as any} size={size} color={color} />;
}

function ClassicTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          position: "absolute",
          backgroundColor:
            Platform.OS === "ios" ? "transparent" : Colors.backgroundSecondary,
          borderTopWidth: 0,
          borderTopColor: Colors.border,
          elevation: 0,
          height: Platform.select({ ios: 84, android: 64, default: 84 }),
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={90}
              tint="dark"
              style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(10,22,40,0.85)" }]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.backgroundSecondary, borderTopWidth: 1, borderTopColor: Colors.border }]} />
          ),
        tabBarLabelStyle: {
          fontFamily: "Rajdhani_600SemiBold",
          fontSize: 11,
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "speedometer" : "speedometer-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          title: "Session",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "timer" : "timer-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: "Routes",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "map" : "map-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "bar-chart" : "bar-chart-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "cash" : "cash-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: "Deliveries",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "bicycle" : "bicycle-outline"} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
