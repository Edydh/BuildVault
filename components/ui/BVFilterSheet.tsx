import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import BVButton from './BVButton';
import { bvColors, bvRadius, bvSpacing, bvTypography } from '@/lib/theme/tokens';

export type BVFilterOption = {
  id: string;
  label: string;
  selected: boolean;
};

type BVFilterSheetProps = {
  visible: boolean;
  title?: string;
  options: BVFilterOption[];
  onToggle: (id: string) => void;
  onApply: () => void;
  onReset?: () => void;
  onClose: () => void;
};

export function BVFilterSheet({
  visible,
  title = 'Filters',
  options,
  onToggle,
  onApply,
  onReset,
  onClose,
}: BVFilterSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        <ScrollView contentContainerStyle={styles.optionsWrap} showsVerticalScrollIndicator={false}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.option, option.selected && styles.optionSelected]}
              onPress={() => onToggle(option.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionText, option.selected && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.actions}>
          {onReset ? (
            <BVButton title="Reset" variant="ghost" onPress={onReset} style={styles.actionButton} />
          ) : null}
          <BVButton title="Apply" onPress={onApply} style={styles.actionButton} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: bvColors.surface.app,
    borderColor: 'rgba(148,163,184,0.26)',
    borderTopLeftRadius: bvRadius.lg,
    borderTopRightRadius: bvRadius.lg,
    borderWidth: 1,
    bottom: 0,
    maxHeight: '75%',
    paddingHorizontal: bvSpacing[16],
    paddingTop: bvSpacing[12],
    paddingBottom: bvSpacing[24],
    position: 'absolute',
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(203,213,225,0.4)',
    borderRadius: bvRadius.pill,
    height: 4,
    marginBottom: bvSpacing[12],
    width: 48,
  },
  title: {
    ...bvTypography.headingMedium,
    color: bvColors.text.primary,
    marginBottom: bvSpacing[12],
  },
  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: bvSpacing[8],
    paddingBottom: bvSpacing[16],
  },
  option: {
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderColor: 'rgba(148,163,184,0.24)',
    borderRadius: bvRadius.pill,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: bvSpacing[12],
    paddingVertical: bvSpacing[8],
  },
  optionSelected: {
    backgroundColor: 'rgba(58,99,243,0.2)',
    borderColor: 'rgba(58,99,243,0.45)',
  },
  optionText: {
    ...bvTypography.label,
    color: bvColors.text.secondary,
  },
  optionTextSelected: {
    color: bvColors.text.primary,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    marginTop: bvSpacing[8],
  },
  actionButton: {
    flex: 1,
    marginRight: bvSpacing[8],
  },
});

export default BVFilterSheet;

