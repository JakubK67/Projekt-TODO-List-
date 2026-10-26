import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import TasksScreen from './src/screens/TasksScreen';
import TaskFormScreen from './src/screens/TaskFormScreen';
import { colors } from './src/theme';
import type { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.forest, background: colors.background,
    card: colors.forest, text: colors.text, border: colors.border },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={theme}>
        <StatusBar style="dark" />
        <Stack.Navigator initialRouteName="Login" screenOptions={{
          headerStyle: { backgroundColor: colors.forest }, headerTintColor: colors.white,
          headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: colors.background },
        }}>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Tasks" component={TasksScreen} options={{ title: 'Moje zadania', statusBarStyle: 'light' }} />
          <Stack.Screen name="TaskForm" component={TaskFormScreen}
            options={({ route }) => ({ title: route.params?.task ? 'Edytuj zadanie' : 'Dodaj zadanie', statusBarStyle: 'light' })} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
