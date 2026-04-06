import { useAppTheme } from "@/hooks/useAppTheme";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
};

export function ConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
}: ConfirmModalProps) {
  const { colors } = useAppTheme();
  const isAlert = !onCancel;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel || onConfirm}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel || onConfirm}
      >
        <Pressable
          style={[
            styles.modalBox,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          <View style={styles.buttonRow}>
            {!isAlert && (
              <Pressable hitSlop={12} onPress={onCancel} style={styles.button}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 15,
                    fontFamily: "Lexend_600SemiBold",
                  }}
                >
                  {cancelText}
                </Text>
              </Pressable>
            )}
            <Pressable
              hitSlop={12}
              onPress={onConfirm}
              style={[
                styles.button,
                {
                  backgroundColor: isDestructive
                    ? colors.dangerSurface
                    : colors.statusSurface,
                  borderColor: isDestructive
                    ? colors.dangerBorder
                    : colors.statusActive + "22",
                  borderWidth: 0,
                },
              ]}
            >
              <Text
                style={{
                  color: isDestructive ? colors.danger : colors.statusActive,
                  fontSize: 15,
                  fontFamily: "Lexend_700Bold",
                }}
              >
                {isAlert ? "OK" : confirmText}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  modalBox: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 22,
    fontFamily: "Lexend_800ExtraBold",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  message: {
    fontSize: 15,
    fontFamily: "Lexend_400Regular",
    lineHeight: 22,
    marginBottom: 32,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 24,
  },
  button: {
    height: 48,
    minWidth: 100,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
});
