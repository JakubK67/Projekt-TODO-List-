const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const keycloakUrl = (process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? '').replace(/\/+$/, '');
const realm = process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? 'todo-app';

export const config = {
  apiUrl,
  issuer: `${keycloakUrl}/realms/${encodeURIComponent(realm)}`,
  clientId: process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'todo-mobile',
};

export const configReady = /^https?:\/\//.test(apiUrl) && /^https?:\/\//.test(keycloakUrl);
