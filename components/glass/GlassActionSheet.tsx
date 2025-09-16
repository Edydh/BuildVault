import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { GlassModal } from './GlassModal';

export type Action = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type GlassActionSheetProps = {
  visible: boolean;
  title?: string;
  message?: string;
  actions: Action[];
  onClose: () => void;
};

export const GlassActionSheet: React.FC<GlassActionSheetProps> = ({
  visible,
  title,
  message,
  actions,
  onClose,
}) => {
  return (
    <GlassModal visible={visible} onRequestClose={onClose}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 20 }}>
        {title ? (
          <Text style={styles.title}>{title}</Text>
        ) : null}
        {message ? (
          <Text style={styles.message}>{message}</Text>
        ) : null}

        <View style={{ marginTop: 8 }}>
          {actions.map((action, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.actionButton, action.destructive && styles.destructiveButton]}
              onPress={() => {
                onClose();
                setTimeout(action.onPress, 100);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionText, action.destructive && styles.destructiveText]}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GlassModal>
  );
};

const styles = StyleSheet.create({
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    marginTop: 8,
    alignItems: 'center',
  },
  actionText: {
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
  },
  destructiveButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  destructiveText: {
    color: '#EF4444',
  },
  cancelButton: {
    backgroundColor: 'rgba(100,116,139,0.1)',
    borderColor: 'rgba(148,163,184,0.25)',
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default GlassActionSheet;


