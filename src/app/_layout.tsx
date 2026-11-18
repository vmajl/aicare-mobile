
import { Stack } from 'expo-router';
import { AuthProvider } from '../features/auth/AuthContext';
import { PatientProvider } from '../features/patients/PatientContext';
import { MedicationProvider } from '../features/medications/MedicationContext';
import { LegacyMigrationProvider } from '../features/migration/LegacyMigrationContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PatientProvider>
        <LegacyMigrationProvider>
          <MedicationProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="assistente-medicamentos"
                options={{ presentation: 'card' }}
              />
            </Stack>
          </MedicationProvider>
        </LegacyMigrationProvider>
      </PatientProvider>
    </AuthProvider>
  );
}
