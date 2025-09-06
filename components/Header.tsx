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
    <View style={[{
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      backgroundColor: '#0B0F14',
    }, style]} {...rest}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={10}>
              <Ionicons name="chevron-back" size={28} color="#F8FAFC" />
            </TouchableOpacity>
          ) : null}
          <Text style={{ color: '#F8FAFC', fontSize: 24, fontWeight: '600' }}>{title}</Text>
        </View>
        <View>{right}</View>
      </View>
      {search ? (
        <View style={{ marginTop: 12 }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: 'rgba(16,24,38,0.60)',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#1E293B',
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}>
            <Ionicons name="search" size={18} color="#94A3B8" />
            <TextInput
              style={{
                marginLeft: 8,
                color: '#F8FAFC',
                flex: 1,
              }}
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

