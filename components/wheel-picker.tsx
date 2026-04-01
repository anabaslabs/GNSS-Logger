import { useAppTheme } from "@/hooks/useAppTheme";
import React, { useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type WheelPickerProps = {
  items: string[];
  value: string;
  onValueChange: (val: string) => void;
  itemHeight?: number;
};

const DEFAULT_ITEM_HEIGHT = 44;

const PickerItem = React.memo(
  ({
    item,
    index,
    isSelected,
    itemHeight,
    onPress,
    colors,
  }: {
    item: string;
    index: number;
    isSelected: boolean;
    itemHeight: number;
    onPress: (idx: number) => void;
    colors: any;
  }) => {
    return (
      <Pressable
        onPress={() => onPress(index - 1)}
        style={[styles.item, { height: itemHeight }]}
      >
        <Text
          style={[
            styles.itemText,
            {
              color: isSelected ? colors.text : colors.textSecondary,
              opacity: isSelected ? 1 : 0.5,
              fontSize: isSelected ? 18 : 16,
              fontFamily: isSelected
                ? "Lexend_600SemiBold"
                : "Lexend_400Regular",
            },
          ]}
        >
          {item}
        </Text>
      </Pressable>
    );
  },
);

export function WheelPicker({
  items,
  value,
  onValueChange,
  itemHeight = DEFAULT_ITEM_HEIGHT,
}: WheelPickerProps) {
  const { colors } = useAppTheme();
  const flatListRef = useRef<FlatList>(null);

  const extendedItems = useMemo(() => ["", ...items, ""], [items]);

  const currentIndex = items.indexOf(value);
  const initialScrollIndex = currentIndex !== -1 ? currentIndex : 0;

  useEffect(() => {
    if (flatListRef.current && initialScrollIndex >= 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: initialScrollIndex * itemHeight,
          animated: false,
        });
      }, 50);
    }
  }, [initialScrollIndex, itemHeight]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemHeight);
    if (index >= 0 && index < items.length) {
      const newValue = items[index];
      if (newValue !== value) {
        onValueChange(newValue);
      }
    }
  };

  const handleItemPress = (index: number) => {
    flatListRef.current?.scrollToOffset({
      offset: index * itemHeight,
      animated: true,
    });
    onValueChange(items[index]);
  };

  return (
    <View style={[styles.container, { height: itemHeight * 3 }]}>
      <View
        pointerEvents="none"
        style={[
          styles.selectionOverlay,
          {
            height: itemHeight,
            top: itemHeight,
            backgroundColor: colors.borderLight + "22",
            borderColor: colors.borderLight,
            borderTopWidth: 1,
            borderBottomWidth: 1,
          },
        ]}
      />

      <FlatList
        ref={flatListRef}
        data={extendedItems}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => {
          const isValueItem = index > 0 && index <= items.length;
          const isSelected = isValueItem && items[index - 1] === value;

          if (!isValueItem) return <View style={{ height: itemHeight }} />;

          return (
            <PickerItem
              item={item}
              index={index}
              isSelected={isSelected}
              itemHeight={itemHeight}
              onPress={handleItemPress}
              colors={colors}
            />
          );
        }}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScroll}
        onScrollToIndexFailed={() => {}}
        scrollEventThrottle={16}
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
  },
  selectionOverlay: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 8,
    zIndex: 1,
  },
  item: {
    justifyContent: "center",
    alignItems: "center",
  },
  itemText: {
    textAlign: "center",
  },
});
