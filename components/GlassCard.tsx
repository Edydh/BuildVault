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
    <BlurView intensity={intensity} tint="dark" className={`rounded-2xl shadow-glass ${className ?? ''}`} style={style} {...rest}>
      {children}
    </BlurView>
  );
}

