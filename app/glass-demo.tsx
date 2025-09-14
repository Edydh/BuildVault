import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  GlassCard,
  GlassButton,
  GlassHeader,
  GlassTabBar,
} from '../components/glass';
import { useRouter } from 'expo-router';

export default function GlassDemo() {
  const router = useRouter();
  const scrollY = useSharedValue(0);
  const [activeTab, setActiveTab] = useState('home');
  const [searchText, setSearchText] = useState('');

  const tabs = [
    { key: 'home', title: 'Home', icon: 'home' as const },
    { key: 'projects', title: 'Projects', icon: 'folder' as const, badge: 3 },
    { key: 'camera', title: 'Camera', icon: 'camera' as const },
    { key: 'settings', title: 'Settings', icon: 'settings' as const },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <GlassHeader
        title="Glass UI Demo"
        onBack={() => router.back()}
        scrollY={scrollY}
        search={{
          value: searchText,
          onChange: setSearchText,
          placeholder: 'Search glass components...',
        }}
        transparent={false}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Glass Cards</Text>
        
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>Default Glass Card</Text>
          <Text style={styles.cardText}>
            This is a glass card with blur effect, gradient, and animated entrance.
          </Text>
        </GlassCard>

        <GlassCard
          intensity={100}
          tint="extraLight"
          gradient={true}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>High Intensity Glass</Text>
          <Text style={styles.cardText}>
            Maximum blur intensity with extra light tint for a frosted appearance.
          </Text>
        </GlassCard>

        <GlassCard
          intensity={40}
          gradient={false}
          shadowEnabled={false}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>Minimal Glass</Text>
          <Text style={styles.cardText}>
            Low intensity, no gradient, no shadow for a subtle effect.
          </Text>
        </GlassCard>

        <Text style={styles.sectionTitle}>Glass Buttons</Text>
        
        <View style={styles.buttonRow}>
          <GlassButton
            title="Primary"
            variant="primary"
            onPress={() => Alert.alert('Primary Button')}
          />
          <GlassButton
            title="Secondary"
            variant="secondary"
            onPress={() => Alert.alert('Secondary Button')}
          />
        </View>

        <View style={styles.buttonRow}>
          <GlassButton
            title="Success"
            variant="success"
            icon="checkmark"
            onPress={() => Alert.alert('Success!')}
          />
          <GlassButton
            title="Danger"
            variant="danger"
            icon="warning"
            onPress={() => Alert.alert('Danger!')}
          />
        </View>

        <Text style={styles.sectionTitle}>Button Sizes</Text>
        
        <View style={styles.buttonColumn}>
          <GlassButton
            title="Small Button"
            size="small"
            fullWidth
            onPress={() => {}}
          />
          <GlassButton
            title="Medium Button"
            size="medium"
            fullWidth
            onPress={() => {}}
          />
          <GlassButton
            title="Large Button"
            size="large"
            fullWidth
            onPress={() => {}}
          />
        </View>

        <Text style={styles.sectionTitle}>Button States</Text>
        
        <View style={styles.buttonColumn}>
          <GlassButton
            title="Loading..."
            loading
            fullWidth
            onPress={() => {}}
          />
          <GlassButton
            title="Disabled"
            disabled
            fullWidth
            onPress={() => {}}
          />
          <GlassButton
            title="With Icon"
            icon="add-circle"
            iconPosition="right"
            fullWidth
            onPress={() => {}}
          />
        </View>

        <Text style={styles.sectionTitle}>Glass Effects Preview</Text>
        
        <GlassCard style={styles.previewCard}>
          <View style={styles.previewContent}>
            <Text style={styles.previewTitle}>✨ Liquid Glass UI</Text>
            <Text style={styles.previewText}>
              Modern glass morphism design with:
            </Text>
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>• Dynamic blur effects</Text>
              <Text style={styles.featureItem}>• Smooth animations</Text>
              <Text style={styles.featureItem}>• Gradient overlays</Text>
              <Text style={styles.featureItem}>• Haptic feedback</Text>
              <Text style={styles.featureItem}>• Adaptive theming</Text>
            </View>
            <GlassButton
              title="Learn More"
              icon="information-circle"
              variant="primary"
              style={{ marginTop: 16 }}
              fullWidth
              onPress={() => Alert.alert('Glass UI', 'SDK 54 Liquid Glass Design System')}
            />
          </View>
        </GlassCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      <GlassTabBar
        tabs={tabs}
        activeTab={activeTab}
        onTabPress={setActiveTab}
        scrollY={scrollY}
        hideOnScroll={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#F8FAFC',
    marginTop: 24,
    marginBottom: 16,
  },
  card: {
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  buttonColumn: {
    gap: 12,
    marginBottom: 12,
  },
  previewCard: {
    padding: 20,
    marginTop: 8,
  },
  previewContent: {
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
    textAlign: 'center',
  },
  previewText: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 16,
    textAlign: 'center',
  },
  featureList: {
    alignSelf: 'stretch',
  },
  featureItem: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
});
