import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { FatigueProvider } from "@/context/FatigueContext";
import { CustomerProvider } from "@/context/CustomerContext";
import { DeliveryProvider } from "@/context/DeliveryContext";
import { AdminProvider } from "@/context/AdminContext";
import {
  useFonts,
  Rajdhani_400Regular,
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from "@expo-google-fonts/rajdhani";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(customer)" options={{ headerShown: false }} />
      <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: true,
          title: "Driver Profile",
          presentation: "modal",
          headerStyle: { backgroundColor: Colors.backgroundSecondary },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontFamily: "Rajdhani_700Bold",
            fontSize: 18,
          },
        }}
      />
      <Stack.Screen
        name="tips"
        options={{
          headerShown: true,
          title: "Safety Tips",
          presentation: "modal",
          headerStyle: { backgroundColor: Colors.backgroundSecondary },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontFamily: "Rajdhani_700Bold",
            fontSize: 18,
          },
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Rajdhani_400Regular,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FatigueProvider>
          <CustomerProvider>
            <DeliveryProvider>
              <AdminProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </AdminProvider>
            </DeliveryProvider>
          </CustomerProvider>
        </FatigueProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
