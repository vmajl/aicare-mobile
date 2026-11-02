
import { Stack } from 'expo-router';
import { AuthProvider } from '../features/auth/AuthContext';
import { PatientProvider } from '../features/patients/PatientContext';
import { MedicationProvider } from '../features/medications/MedicationContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PatientProvider>
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
      </PatientProvider>
    </AuthProvider>
  );
}
