import React from 'react';
import { View, Text, Switch, ViewStyle, TextStyle } from 'react-native';

type GlassSwitchProps = {
  label?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  disabled?: boolean;
};

export const GlassSwitch: React.FC<GlassSwitchProps> = ({
  label,
  value,
  onValueChange,
  containerStyle,
  labelStyle,
  disabled,
}) => {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, containerStyle]}>
      {label ? (
        <Text style={[{ color: '#F8FAFC', fontSize: 16, fontWeight: '500' }, labelStyle]}>
          {label}
        </Text>
      ) : (
        <View />
      )}
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#374151', true: '#FF7A1A' }}
        thumbColor="#F8FAFC"
        disabled={disabled}
      />
    </View>
  );
};

export default GlassSwitch;


