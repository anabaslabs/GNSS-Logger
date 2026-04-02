import { useAppTheme } from "@/hooks/useAppTheme";
import {
  IconDashboard,
  IconFolder,
  IconPlanet,
  IconSettings,
} from "@tabler/icons-react-native";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.background,
          height: 80,
        },
        headerTitleAlign: "left",
        headerTitleStyle: {
          fontFamily: "Lexend_700Bold",
          fontSize: 20,
          color: colors.text,
          marginLeft: 8,
          marginBottom: 8,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 80,
          paddingBottom: 25,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: "Lexend_600SemiBold",
          fontSize: 12,
          marginTop: -4,
        },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.iconSecondary,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <IconDashboard
              color={color}
              size={24}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="satellites"
        options={{
          title: "Satellites",
          tabBarLabel: "Satellites",
          tabBarIcon: ({ color, focused }) => (
            <IconPlanet
              color={color}
              size={24}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: "Logs",
          tabBarLabel: "Logs",
          tabBarIcon: ({ color, focused }) => (
            <IconFolder
              color={color}
              size={24}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarLabel: "Settings",
          tabBarIcon: ({ color, focused }) => (
            <IconSettings
              color={color}
              size={24}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
    </Tabs>
  );
}
