# Aplikacja mobilna — etap 2

Logowanie korzysta z kont Keycloak i potwierdzenia urządzenia (OAuth Device Authorization Grant), dzięki czemu działa w Expo Go bez własnego schematu przekierowań. Hasło i OTP wpisuje się wyłącznie na stronie Keycloak. Po zatwierdzeniu urządzenia należy wrócić do aplikacji.

## Uruchomienie

Konfiguracja jest przygotowana dla komputera `192.168.1.9`. Telefon musi mieć dostęp do portów 3000 (API przez frontend) i 8081 (Keycloak). Tunel Expo udostępnia serwer Expo, ale nie udostępnia automatycznie API ani Keycloak. Przy tej konfiguracji połącz oba urządzenia z tą samą siecią Wi-Fi.

W katalogu głównym projektu uruchom:

```powershell
docker compose up -d --build
powershell -ExecutionPolicy Bypass -File .\keycloak\configure-mobile-client.ps1
```

Skrypt tworzy lub aktualizuje wyłącznie klienta `todo-mobile` w istniejącym realmie. Korzysta z danych administratora w `.env`. Import realmu przy starcie Keycloak nie aktualizuje istniejącego realmu, dlatego skrypt jest potrzebny także dla wcześniej uruchamianej instalacji.

Następnie:

```powershell
cd mobile
npm start -- --tunnel --clear
```

Na telefonie otwórz projekt w Expo Go i wybierz „Zaloguj się”. Potwierdź zgodność wyświetlanego kodu urządzenia, zaloguj się i wykonaj wymaganą weryfikację OTP. Zatwierdź dostęp i wróć do aplikacji.

Przy zmianie adresu komputera należy zaktualizować adresy w `mobile/.env.local` (wzór w `.env.example` tego katalogu) oraz `KEYCLOAK_MOBILE_ISSUER` w głównym `.env`, przebudować lub odtworzyć backend i zrestartować Expo z `--clear`.

## Zachowanie

- Lista pobiera własne zadania z istniejącego `GET /api/tasks`, łącznie z nazwą projektu.
- Przeciągnięcie listy w dół odświeża dane. Dostępne są filtry statusu, stan wczytywania i ponowienie po błędzie.
- Tokeny na telefonie zapisuje Expo SecureStore. Sesja jest odświeżana automatycznie. Wylogowanie usuwa lokalną sesję i próbuje unieważnić refresh token w Keycloak. Bez sieci unieważnienie na serwerze może się nie powieść.
- Tryb demonstracyjny pozostaje oddzielony od danych konta. Formularze nadal służą do podglądu; zapis, edycja i usuwanie są kolejnym etapem.
- Publiczne statystyki i logowanie aplikacji webowej pozostają dostępne na dotychczasowych zasadach.
- Do publicznego wdrożenia należy użyć adresów HTTPS zamiast adresów HTTP lokalnej sieci.

## Zabezpieczenia i testy

Backend przyjmuje Bearer wyłącznie dla skonfigurowanego klienta mobilnego i wystawcy. Weryfikuje podpis JWT, odbiorcę, klienta, typ access tokenu, ważność i MFA. Nie akceptuje tokenów klienta webowego jako mobilnych. Sesje webowe nadal wymagają CSRF przy zmianach danych.

```powershell
php backend/tests/mobile_auth.php
php backend/tests/public_statistics.php
cd mobile
npm test
npm run typecheck
npm run export:check
```

Test backendu wykorzystuje tymczasową bazę SQLite i podpisane tokeny testowe. Testy mobilne korzystają z symulowanych odpowiedzi HTTP. Nie zastępują sprawdzenia logowania i łączności na fizycznym telefonie z działającym Keycloak.
