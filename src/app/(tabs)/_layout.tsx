import { Tabs } from 'expo-router';
import {
  Home,
  BookOpen,
  Pill,
  Users,
} from 'lucide-react-native';

const COLORS = {
  blue: '#50A9C3',
  muted: '#6D8794',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.blue,
        tabBarInactiveTintColor: COLORS.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="diario"
        options={{
          title: 'Diário',
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="medicamentos"
        options={{
          title: 'Medicamentos',
          tabBarIcon: ({ color, size }) => (
            <Pill color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="pessoas"
        options={{
          title: 'Pessoas',
          tabBarIcon: ({ color, size }) => (
            <Users color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}