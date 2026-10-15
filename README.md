# Aplikacja TODO — dokumentacja

Aplikacja do zarządzania zadaniami i projektami. Interfejs jest napisany w React, backend w PHP, a dane aplikacji są przechowywane w MySQL. Logowanie, rejestrację i konta użytkowników obsługuje Keycloak korzystający z osobnej bazy PostgreSQL.

## Funkcje

- Logowanie, rejestracja i wylogowanie przez Keycloak.
- Dodawanie zadań z nazwą, opisem, terminem, priorytetem i statusem.
- Wyświetlanie zadań zalogowanego użytkownika.
- Edycja i usuwanie zadań.
- Dodawanie projektów z nazwą i opcjonalnym opisem.
- Przypisywanie nowego zadania do własnego projektu lub wybór „Brak”.
- Wyświetlanie nazwy projektu nad nazwą zadania; nagłówek nie pojawia się dla zadań bez projektu.
- Panel użytkownika z edycją nazwy użytkownika, emaila, imienia i nazwiska oraz zmianą hasła.

Widok „Użytkownicy” jest dostępny w nawigacji dla roli `admin`, ale obecnie zawiera tylko miejsce na przyszłe zarządzanie użytkownikami.

## Technologie

| Element | Technologia |
| --- | --- |
| Frontend | React, React Router, Vite, Axios |
| Serwowanie frontendu w Dockerze | Nginx |
| Backend | PHP 8.3, PDO MySQL, MySQLi |
| Weryfikacja tokenów | `firebase/php-jwt` |
| Dane aplikacji | MySQL 8.4 |
| Obsługa kont | Keycloak 26.0 |
| Baza Keycloak | PostgreSQL 16 |
| Podgląd bazy aplikacji | phpMyAdmin |

## Uruchomienie przez Docker

Wymagane są Docker z obsługą Linux containers i Docker Compose. Polecenia wykonuj w katalogu głównym projektu.

### 1. Przygotowanie konfiguracji

Jeżeli nie masz pliku `.env`, skopiuj przykład:

```powershell
Copy-Item .env.example .env
```

W obecnym `.env.example` linia `touch backend/.gitkeepAPP_DB_ROOT_PASSWORD=admin` jest błędna. W swoim `.env` zastąp ją poprawnym wpisem `APP_DB_ROOT_PASSWORD=...`. Plik powinien zawierać następujące zmienne z wybranymi przez Ciebie wartościami:

```dotenv
APP_DB_NAME=todo
APP_DB_USER=todo
APP_DB_PASSWORD=twoje_haslo_bazy
APP_DB_ROOT_PASSWORD=twoje_haslo_root
KC_DB_USER=keycloak
KC_DB_PASSWORD=twoje_haslo_postgresql
KC_ADMIN_USER=admin
KC_ADMIN_PASSWORD=twoje_haslo_administratora
```

Plik `.env` jest wyłączony z Git. Nie umieszczaj rzeczywistych haseł w dokumentacji ani repozytorium.

Aktualne `edittasks.php` i `deletetasks.php` mają wpisane na stałe dane połączenia `db`, `todo`, `admin`, `todo`. Zmiana danych MySQL w `.env` wymaga również dopasowania tych dwóch plików. Pozostałe endpointy korzystają z konfiguracji środowiskowej.

### 2. Sprawdzenie inicjalizacji MySQL

`docker-compose.yml` zawiera montowanie:

```yaml
- ./db/init.sql:/docker-entrypoint-initdb.d/init.sql
```

W aktualnym katalogu projektu `db/init.sql` jest katalogiem, a nie plikiem SQL. Jeżeli korzystasz z automatycznego tworzenia tabel przez backend, usuń tę linię montowania z konfiguracji Compose. Jeżeli chcesz inicjalizować bazę skryptem, ścieżka musi wskazywać rzeczywisty plik SQL.

Do utworzenia pustych tabel nie jest potrzebny import zrzutu z danymi. `index.php` tworzy brakujące tabele przy obsłudze żądania; aplikacja wywołuje `/api/me` po zalogowaniu. Tabele istniejące nie są czyszczone. Rekord użytkownika jest dodawany przy pierwszym wywołaniu `/api/me`.

### 3. Start usług

```powershell
docker compose up -d --build
docker compose ps
```

| Usługa | Adres |
| --- | --- |
| Aplikacja | http://localhost:3000 |
| Backend | http://localhost:8080 |
| Keycloak i panel administratora | http://localhost:8081 |
| phpMyAdmin | http://localhost:8082 |
| MySQL | `localhost:3306` |

Pierwszy start może potrwać dłużej ze względu na budowanie obrazów oraz inicjalizację baz. Dane logowania administratora Keycloak określają `KC_ADMIN_USER` i `KC_ADMIN_PASSWORD`.

Realm aplikacji to `todo-app`, a klient frontendu to `todo-frontend`. Konfiguracja realm jest montowana z katalogu `keycloak/`. Import może też utworzyć konta zapisane w plikach JSON. Nie oznacza to importu zadań i projektów do MySQL.

### 4. Zmiany i zatrzymanie aplikacji

Po zmianie kodu frontendu przebuduj jego obraz i odśwież przeglądarkę przez Ctrl+F5:

```powershell
docker compose up -d --build frontend
```

Pliki `backend/public` są montowane do kontenera, więc ich zmiany zwykle nie wymagają przebudowy. Po zmianie konfiguracji środowiskowej odtwórz odpowiednią usługę przez `docker compose up -d`. Zmiana Dockerfile lub zależności backendu wymaga przebudowy obrazu backendu.

```powershell
docker compose up -d --build backend
docker compose logs --tail=100 backend
docker compose logs --tail=100 keycloak
docker compose down
```

`docker compose down` zachowuje nazwane wolumeny baz. Nie używaj opcji `-v`, jeśli chcesz zachować dane. Zmiana haseł w `.env` nie zmienia automatycznie haseł użytkowników w istniejących bazach.

### Zastosowanie zmian konfiguracji Keycloak po aktualizacji repozytorium

Keycloak przechowuje realm, konta, hasła i konfigurację MFA w osobnym wolumenie PostgreSQL. Podczas startu `--import-realm` pomija realm, który już istnieje, więc samo `git pull` ani `docker compose up` nie aktualizuje konfiguracji wcześniej uruchomionego Keycloaka. Konta i kody MFA nie są przenoszone przez Git.

Jeśli lokalny Keycloak ma starą konfigurację przepływu logowania, można w środowisku deweloperskim zaimportować realm ponownie. Poniższe polecenia usuwają **wyłącznie wolumen Keycloaka**; konta Keycloak, ich hasła i MFA zostaną skasowane. Wolumen MySQL z zadaniami i projektami pozostaje bez zmian:

```powershell
docker compose down
docker volume ls --filter label=com.docker.compose.volume=keycloak_db_data
docker volume rm <nazwa-wolumenu-keycloak_db_data-z-poprzedniego-polecenia>
docker compose up -d --build
```

Każdy współpracownik powinien zarejestrować własne konto na ekranie logowania albo użyć kont demonstracyjnych z `keycloak/todo-app-realm.json` (`user1` / `user123` lub `admin1` / `admin123`). Konto utworzone lokalnie przez inną osobę nie jest dostępne po `git pull`.

## Struktura projektu

```text
backend/
  public/
    index.php         — inicjalizacja tabel, profil użytkownika, lista projektów
    addtasks.php      — dodawanie zadań
    showtasks.php     — pobieranie zadań i nazwy projektu
    edittasks.php     — edycja zadań
    deletetasks.php   — usuwanie zadań
    addprojects.php   — dodawanie projektów
  composer.json
  Dockerfile
frontend/
  src/
    pages/
      Home.jsx        — formularz zadania i lista zadań
      Projects.jsx    — formularz projektu i lista projektów
      UserMenu.jsx    — edycja danych konta i hasła
      Users.jsx       — miejsce na panel administratora
      Profile.jsx     — dodatkowy komponent profilu, bez trasy w App.jsx
    App.jsx           — nawigacja i trasy
    main.jsx          — inicjalizacja logowania i React
    keycloak.js       — konfiguracja klienta Keycloak
    App.css
    index.css
  index.html
  Dockerfile
keycloak/             — konfiguracje realm
keycloak-themes/      — motyw logowania
docker-compose.yml
.env.example
```

## Baza aplikacji

`index.php` tworzy trzy tabele przez `CREATE TABLE IF NOT EXISTS`. Dodatkowo uzupełnia brakujące kolumny `id`, `first_name` i `last_name` tabeli `users`. Nie wykonuje pełnej migracji wszystkich istniejących tabel.

| Tabela | Najważniejsze kolumny |
| --- | --- |
| `users` | `id`, `keycloak_id`, `username`, `first_name`, `last_name`, `email`, `role`, `created_at`, `last_login` |
| `projects` | `id`, `name`, `description`, `user_id` |
| `tasks` | `id`, `name`, `description`, `deadline`, `created`, `updated`, `priority`, `status`, `user_id`, `project_id` |

Powiązania użytkowników różnią się między tabelami:

- `users.id` to liczbowy, unikalny identyfikator z `AUTO_INCREMENT`.
- `users.keycloak_id` to tekstowy identyfikator konta Keycloak i klucz główny tabeli.
- `tasks.user_id` przechowuje liczbowy `users.id`.
- `projects.user_id` przechowuje tekstowy `users.keycloak_id`; istnieje dla niego klucz obcy.
- `tasks.project_id` zawiera numer projektu lub `NULL` dla wyboru „Brak”. Powiązanie sprawdza `addtasks.php`; schemat nie definiuje dla niego klucza obcego.

Priorytety: `Niski`, `Normalny`, `Wysoki`. Statusy: `Do zrobienia`, `Realizowane`, `Wykonane`.

Numery `AUTO_INCREMENT` mogą zawierać luki. Nie należy traktować ich jako kolejnych numerów użytkowników na liście.

## API

Żądania z danymi wysyłają JSON i nagłówek `Content-Type: application/json`. Endpointy sprawdzające logowanie wymagają `Authorization: Bearer <token>`.

| Metoda | Ścieżka | Działanie | Token wymagany w aktualnym kodzie |
| --- | --- | --- | --- |
| GET | `/api/me` | Dodanie użytkownika przy pierwszym użyciu, aktualizacja czasu logowania i pobranie profilu | Tak |
| PUT | `/api/me` | Zapis nazwy użytkownika, emaila, imienia i nazwiska w Keycloak i MySQL | Tak |
| PUT | `/api/me/password` | Sprawdzenie obecnego hasła i ustawienie nowego w Keycloak | Tak |
| GET | `/api/projects` | Lista projektów zalogowanego użytkownika | Tak |
| POST | `/addprojects.php` | Utworzenie projektu | Tak |
| POST | `/addtasks.php` | Utworzenie zadania, opcjonalnie w projekcie użytkownika | Tak |
| GET | `/showtasks.php` | Zadania użytkownika wraz z nazwą projektu | Tak |
| POST lub PUT | `/edittasks.php` | Edycja zadania po `id` | Nie |
| POST lub DELETE | `/deletetasks.php` | Usunięcie zadania po `id` | Nie |

Przykładowe dane dodawania projektu:

```json
{"name": "Praktyki", "description": "Zadania związane z praktykami"}
```

Przykładowe dane dodawania zadania:

```json
{
  "name": "Przygotować dokumentację",
  "desc": "Opisać uruchomienie i funkcje aplikacji",
  "deadline": "2026-10-20",
  "priority": "1",
  "status": "0",
  "project_id": null
}
```

Przy dodawaniu zadania `priority` i `status` oznaczają indeksy od zera w podanych wcześniej listach. Przy edycji zadania backend oczekuje pełnych nazw priorytetu i statusu oraz pola `description` zamiast `desc`.

## Panel użytkownika i Keycloak

Kliknięcie nazwy użytkownika w nawigacji otwiera `/usermenu`. Aktualny formularz zapisuje dane przez backend aplikacji. Backend korzysta z Keycloak Admin API oraz danych `KEYCLOAK_ADMIN_USERNAME` i `KEYCLOAK_ADMIN_PASSWORD`, przekazywanych z Compose. Hasła kont nie są zapisywane w tabeli `users` aplikacji.

Zmiana hasła wymaga obecnego hasła, nowego hasła i potwierdzenia. Backend sprawdza obecne hasło za pomocą endpointu tokenów Keycloak, a następnie ustawia nowe hasło przez Admin API. Ten przepływ wymaga dostępności klienta `admin-cli` i odpowiedniej konfiguracji w realm `todo-app`.

Możliwość zmiany nazwy użytkownika zależy od ustawienia **Realm settings → Login → Edit username** w Keycloak. Modyfikacja lokalnego pliku importu nie aktualizuje automatycznie już istniejącego realm.

## Sprawdzenie działania

1. Uruchom usługi i zaloguj się lub zarejestruj konto.
2. Dodaj projekt w zakładce „Projekty” i sprawdź jego obecność na liście.
3. Dodaj zadanie z wyborem „Brak”, a następnie drugie z wybranym projektem.
4. Sprawdź w phpMyAdmin `user_id` i `project_id` obu zadań.
5. Sprawdź, czy lista zadań pokazuje nazwę projektu tylko dla przypisanego zadania.
6. Zaloguj się na inne konto i sprawdź odrębność list zadań i projektów.
7. Przetestuj edycję danych profilu i zmianę hasła.

## Obecne ograniczenia

- Edycja i usuwanie zadań nie sprawdzają tokenu ani właściciela zadania. Przed udostępnieniem aplikacji innym osobom wymagają uzupełnienia autoryzacji.
- Zmiana projektu jest dostępna przy dodawaniu zadania; aktualny formularz edycji nie zmienia `project_id`.
- Lista projektów pokazuje nazwy i opisy, bez edycji oraz usuwania projektów.
- Panel administratora użytkowników nie jest jeszcze zaimplementowany.
- Konfiguracja serwerów, CORS i przekierowań jest przygotowana dla lokalnych adresów `localhost`.
- Backend używa deweloperskiego serwera PHP, a Keycloak uruchamia się przez `start-dev`.
- Projekt nie zawiera zestawu automatycznych testów funkcjonalnych.

Dokumentacja opisuje kod znajdujący się w repozytorium. Nie stanowi potwierdzenia testu całego środowiska Docker.
