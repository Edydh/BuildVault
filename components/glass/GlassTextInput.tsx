import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useGlassMorphism } from './GlassThemeProvider';

type GlassTextInputProps = {
  label?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  helperText?: string;
  errorText?: string;
} & Omit<TextInputProps, 'style'>;

export const GlassTextInput: React.FC<GlassTextInputProps> = ({
  label,
  required,
  containerStyle,
  inputStyle,
  helperText,
  errorText,
  value,
  onChangeText,
  placeholder,
  returnKeyType,
  autoCapitalize,
  onSubmitEditing,
  multiline,
  ...rest
}) => {
  const theme = useGlassMorphism(60);
  const [isFocused, setIsFocused] = useState(false);

  const resolvedBorderColor = useMemo(() => {
    if (errorText) return '#EF4444';
    if (isFocused) return '#FF7A1A';
    return '#64748B';
  }, [errorText, isFocused]);

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? ' *' : ''}
        </Text>
      ) : null}

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        style={[
          styles.input,
          {
            backgroundColor:
              Platform.OS === 'android'
                ? 'rgba(30, 41, 59, 0.85)'
                : theme.colors.background,
            borderColor: resolvedBorderColor,
          },
          inputStyle,
        ]}
        returnKeyType={returnKeyType}
        autoCapitalize={autoCapitalize}
        onSubmitEditing={onSubmitEditing}
        multiline={multiline}
        keyboardAppearance="dark"
        selectionColor="#FF7A1A"
        cursorColor="#FF7A1A"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...rest}
      />

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
      {!errorText && helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#F8FAFC', // ensure light text
    borderWidth: 2,
    minHeight: 50,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 12,
    marginTop: 6,
  },
  helperText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 6,
  },
});

export default GlassTextInput;


