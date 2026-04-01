import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useAppTheme } from '@/hooks/useAppTheme';

export type WheelPickerProps = {
  items: string[];
  value: string;
  onValueChange: (val: string) => void;
  itemHeight?: number; // Kept for prop compatibility, ignored natively
};

export function WheelPicker({ items, value, onValueChange }: WheelPickerProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      {/* @ts-expect-error React 19 typing compatibility issue with Picker children */}
      <Picker
        selectedValue={value}
        onValueChange={(val) => onValueChange(String(val))}
        style={[styles.picker, process.env.EXPO_OS === 'android' && { color: colors.text }]}
        itemStyle={[styles.pickerItem, { color: colors.text }]}
        dropdownIconColor={colors.text}
      >
        {items.map((item) => (
          <Picker.Item key={item} label={item} value={item} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: 150,
  },
  pickerItem: {
    fontSize: 22,
    fontFamily: 'Lexend_500Medium',
  },
});
