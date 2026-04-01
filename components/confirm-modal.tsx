import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

export type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
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
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
}: ConfirmModalProps) {
  const { colors } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        {/* We catch the press on the inner Box so it doesn't trigger the overlay cancellation */}
        <Pressable style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          
          <View style={styles.buttonRow}>
            <Pressable hitSlop={12} onPress={onCancel} style={styles.button}>
              <Text style={{ color: colors.textSecondary, fontSize: 16, fontFamily: 'Lexend_600SemiBold' }}>
                {cancelText.toUpperCase()}
              </Text>
            </Pressable>
            <Pressable hitSlop={12} onPress={onConfirm} style={styles.button}>
              <Text
                style={{
                  color: isDestructive ? colors.danger : colors.statusActive,
                  fontSize: 16,
                  fontFamily: 'Lexend_600SemiBold',
                }}
              >
                {confirmText.toUpperCase()}
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: 28,
    boxShadow: "0 10px 20px rgba(0,0,0,0.25)",
  },
  title: {
    fontSize: 22,
    fontFamily: 'Lexend_700Bold',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    fontFamily: 'Lexend_400Regular',
    lineHeight: 22,
    marginBottom: 32,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 32,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
});
