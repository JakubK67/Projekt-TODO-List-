import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import TasksScreen from './src/screens/TasksScreen';
import TaskFormScreen from './src/screens/TaskFormScreen';
import ProjectsScreen from './src/screens/ProjectsScreen';
import ProjectFormScreen from './src/screens/ProjectFormScreen';
import UserPanelScreen from './src/screens/UserPanelScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import UserMenu from './src/components/UserMenu';
import { colors } from './src/theme';
import type { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.forest, background: colors.background,
    card: colors.forest, text: colors.text, border: colors.border },
};

function AppNavigation() {
  const { user, demo, loading } = useAuth();
  const headerRight = () => <UserMenu />;
  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, backgroundColor: colors.background }}>
    <ActivityIndicator color={colors.forest} /><Text style={{ color: colors.text }}>Przywracanie sesji…</Text>
  </View>;
  return (
      <NavigationContainer theme={theme}>
        <StatusBar style="dark" />
        <Stack.Navigator screenOptions={{
          headerStyle: { backgroundColor: colors.forest }, headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: colors.background },
        }}>
          {user || demo ? <Stack.Group navigationKey={user?.sub ?? 'demo'} screenOptions={{ headerRight }}>
          <Stack.Screen name="Tasks" component={TasksScreen} options={{ title: 'Moje zadania', statusBarStyle: 'light', headerRight, animation: 'none' }} />
          <Stack.Screen name="TaskForm" component={TaskFormScreen}
            options={({ route }) => ({ title: route.params?.task ? 'Edytuj zadanie' : 'Dodaj zadanie', statusBarStyle: 'light' })} />
          <Stack.Screen name="Projects" component={ProjectsScreen} options={{ title: 'Moje projekty', statusBarStyle: 'light', headerRight, animation: 'none' }} />
          <Stack.Screen name="ProjectForm" component={ProjectFormScreen}
            options={({ route }) => ({ title: route.params?.project ? 'Edytuj projekt' : 'Dodaj projekt', statusBarStyle: 'light' })} />
          <Stack.Screen name="UserPanel" component={UserPanelScreen} options={{ title: 'Panel użytkownika', statusBarStyle: 'light' }} />
          <Stack.Screen name="Statistics" component={StatisticsScreen} options={{ title: 'Statystyki', statusBarStyle: 'light' }} />
          </Stack.Group> : <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />}
        </Stack.Navigator>
      </NavigationContainer>
  );
}

export default function App() {
  return <SafeAreaProvider><AuthProvider><AppNavigation /></AuthProvider></SafeAreaProvider>;
}
