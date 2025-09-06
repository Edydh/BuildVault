import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SHARING_QUALITIES, SharingQuality, getSharingUri, ImageVariants } from '@/lib/imageOptimization';

interface SharingQualitySelectorProps {
  variants: ImageVariants;
  onShare: (uri: string, quality: SharingQuality) => void;
  onClose: () => void;
  visible: boolean;
}

export default function SharingQualitySelector({
  variants,
  onShare,
  onClose,
  visible,
}: SharingQualitySelectorProps) {
  const [selectedQuality, setSelectedQuality] = useState<SharingQuality>('full');

  const handleShare = () => {
    const sharingUri = getSharingUri(variants, selectedQuality);
    onShare(sharingUri, selectedQuality);
    onClose();
  };

  const getQualityDescription = (quality: SharingQuality) => {
    switch (quality) {
      case 'thumbnail':
        return 'Small size, fast sharing';
      case 'preview':
        return 'Medium size, good quality';
      case 'full':
        return 'High quality, larger file';
      case 'original':
        return 'Maximum quality, largest file';
      default:
        return '';
    }
  };

  const getFileSizeEstimate = (quality: SharingQuality) => {
    switch (quality) {
      case 'thumbnail':
        return '~50KB';
      case 'preview':
        return '~200KB';
      case 'full':
        return '~800KB';
      case 'original':
        return '~2MB+';
      default:
        return '';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        paddingHorizontal: 20,
      }}>
        <View style={{
          backgroundColor: '#101826',
          borderRadius: 20,
          padding: 24,
          maxHeight: '80%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}>
          <Text style={{
            color: '#F8FAFC',
            fontSize: 24,
            fontWeight: 'bold',
            marginBottom: 20,
            textAlign: 'center',
          }}>
            Choose Sharing Quality
          </Text>

          <Text style={{
            color: '#94A3B8',
            fontSize: 16,
            marginBottom: 24,
            textAlign: 'center',
            lineHeight: 22,
          }}>
            Select the image quality for sharing. Higher quality means larger file sizes.
          </Text>

          {Object.entries(SHARING_QUALITIES).map(([key, quality]) => (
            <TouchableOpacity
              key={key}
              style={{
                backgroundColor: selectedQuality === key ? '#FF7A1A' : '#1F2A37',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                borderWidth: 2,
                borderColor: selectedQuality === key ? '#FF7A1A' : '#374151',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onPress={() => setSelectedQuality(key as SharingQuality)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: selectedQuality === key ? '#0B0F14' : '#F8FAFC',
                  fontSize: 16,
                  fontWeight: '600',
                  marginBottom: 4,
                }}>
                  {quality.label}
                </Text>
                <Text style={{
                  color: selectedQuality === key ? '#0B0F14' : '#94A3B8',
                  fontSize: 14,
                  marginBottom: 2,
                }}>
                  {getQualityDescription(key as SharingQuality)}
                </Text>
                <Text style={{
                  color: selectedQuality === key ? '#0B0F14' : '#64748B',
                  fontSize: 12,
                }}>
                  Estimated size: {getFileSizeEstimate(key as SharingQuality)}
                </Text>
              </View>
              
              {selectedQuality === key && (
                <Ionicons name="checkmark-circle" size={24} color="#0B0F14" />
              )}
            </TouchableOpacity>
          ))}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
            <TouchableOpacity
              style={{
                backgroundColor: '#374151',
                borderRadius: 12,
                padding: 16,
                flex: 1,
                marginRight: 8,
                alignItems: 'center',
              }}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '600' }}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: '#FF7A1A',
                borderRadius: 12,
                padding: 16,
                flex: 1,
                marginLeft: 8,
                alignItems: 'center',
              }}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#0B0F14', fontSize: 16, fontWeight: '600' }}>
                Share Image
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
