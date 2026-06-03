import { useAppTheme } from "@/hooks/useAppTheme";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

interface ToogleButtonProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function ToogleButton({
  value,
  onValueChange,
  disabled,
}: ToogleButtonProps) {
  const { isDark } = useAppTheme();
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value, animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 20], // 46 - 2 - 24 = 20
  });

  const trackColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [isDark ? "#48484A" : "#AEAEB2", "#10B981"],
  });

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.track,
        { opacity: disabled ? 0.5 : pressed ? 0.9 : 1 },
      ]}
    >
      <Animated.View
        style={[styles.trackBackground, { backgroundColor: trackColor }]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 46,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
  },
  trackBackground: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    justifyContent: "center",
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
    elevation: 3,
  },
});
