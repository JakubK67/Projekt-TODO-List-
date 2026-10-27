import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { config } from '../config';
import { SessionClient, type User } from '../services/session';

const sessionKey = 'todo-mobile-session-v1';
const client = new SessionClient(config, {
  get: async () => Platform.OS === 'web' ? null : SecureStore.getItemAsync(sessionKey),
  set: async value => { if (Platform.OS !== 'web') await SecureStore.setItemAsync(sessionKey, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  remove: async () => { if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(sessionKey); },
});

type Auth = { user: User | null; demo: boolean; loading: boolean; error: string; client: SessionClient; signedIn: (user: User) => void; startDemo: () => void; logout: () => Promise<void> };
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    let active = true;
    client.onExpired = () => { if (active) setUser(null); };
    client.restore().then(value => { if (active) setUser(value); })
      .catch(() => { if (active) setError('Nie udało się przywrócić sesji. Sprawdź połączenie lub zaloguj się ponownie.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; client.onExpired = () => {}; };
  }, []);
  return <AuthContext.Provider value={{ user, demo, loading, error, client,
    signedIn: value => { setError(''); setDemo(false); setUser(value); }, startDemo: () => setDemo(true),
    logout: async () => {
      setDemo(false); setUser(null);
      try { await client.logout(); } catch { setError('Nie udało się usunąć zapisanej sesji. Spróbuj ponownie.'); }
    },
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Brak kontekstu logowania.');
  return value;
}
