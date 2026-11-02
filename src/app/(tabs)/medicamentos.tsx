
import { ScrollView } from 'react-native';
import MedicinesScreen from '../../features/medications/MedicinesScreen';

export default function MedicamentosRoute() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F4FAFC' }}
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
    >
      <MedicinesScreen />
    </ScrollView>
  );
}
