import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { bvColors, bvRadius, bvSpacing, bvTypography } from '@/lib/theme/tokens';

type BVSearchBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder'>;
};

export function BVSearchBar({
  value,
  onChangeText,
  placeholder = 'Search projects...',
  style,
  inputProps,
}: BVSearchBarProps) {
  return (
    <View style={[styles.container, style]}>
      <Ionicons name="search" size={18} color={bvColors.neutral[200]} style={styles.leadingIcon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={bvColors.neutral[400]}
        style={styles.input}
        returnKeyType="search"
        autoCorrect={false}
        {...inputProps}
      />
      {value.length > 0 ? (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={bvColors.neutral[400]} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(148,163,184,0.26)',
    borderRadius: bvRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: bvSpacing[12],
  },
  leadingIcon: {
    marginRight: bvSpacing[8],
  },
  input: {
    ...bvTypography.bodyRegular,
    color: bvColors.text.primary,
    flex: 1,
    paddingVertical: bvSpacing[12],
  },
});

export default BVSearchBar;

