import { BlurView } from 'expo-blur';
import React from 'react';
import { ViewProps } from 'react-native';

type Props = ViewProps & {
  children?: React.ReactNode;
  intensity?: number;
  className?: string;
};

export default function GlassCard({ children, intensity = 40, className, style, ...rest }: Props) {
  return (
    <BlurView intensity={intensity} tint="dark" style={[{
      borderRadius: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    }, style]} {...rest}>
      {children}
    </BlurView>
  );
}

