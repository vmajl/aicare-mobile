import { ScrollView, StyleSheet, Text } from 'react-native';
import HomeScreen from '../../features/home/HomeScreen';

const BG = '#F4FAFC';

export default function HomeRoute() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <HomeScreen />
      <Text style={styles.disclaimer}>
        AICare · TCC · Dados demonstrativos
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 22,
    gap: 24,
  },
  disclaimer: {
    color: '#8B9AA3',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
});