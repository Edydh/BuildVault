import React from 'react';
import { View, Text, TextInput, ViewProps, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = ViewProps & {
  title: string;
  onBack?: () => void;
  search?: { value: string; onChange: (t: string) => void; placeholder?: string };
  right?: React.ReactNode;
};

export default function Header({ title, onBack, search, right, style, ...rest }: Props) {
  return (
    <View className="px-4 pt-3 pb-2 bg-base" style={style} {...rest}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={10}>
              <Ionicons name="chevron-back" size={28} color="#F8FAFC" />
            </TouchableOpacity>
          ) : null}
          <Text className="text-text-primary text-2xl font-semibold">{title}</Text>
        </View>
        <View>{right}</View>
      </View>
      {search ? (
        <View className="mt-3">
          <View className="flex-row items-center bg-[rgba(16,24,38,0.60)] rounded-2xl border border-border px-3 py-2">
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              className="ml-2 text-text-primary flex-1"
              placeholderTextColor="#94A3B8"
              placeholder={search.placeholder ?? 'Search'}
              value={search.value}
              onChangeText={search.onChange}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

