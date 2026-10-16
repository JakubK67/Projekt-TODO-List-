# Aplikacja TODO — dokumentacja

Stan dokumentacji: **16 października 2026 r.**

Aplikacja służy do zarządzania własnymi zadaniami i projektami. Frontend jest napisany w React, backend korzysta z Symfony 7.4 i PDO, a logowanie obsługuje Keycloak. Dane aplikacji znajdują się w MySQL, natomiast konta i konfiguracja Keycloak w osobnej bazie PostgreSQL.

Dokumentacja opisuje aktualne pliki repozytorium. Konfiguracja już działającego Keycloak może różnić się od pliku importu.

## Funkcje aplikacji

### Zadania

- Dodawanie zadania z nazwą, opisem, terminem, priorytetem i statusem.
- Przypisywanie zadania do własnego projektu podczas dodawania i edycji.
- Opcja „Brak” zapisuje zadanie bez projektu (`project_id = NULL`).
- Wyświetlanie zadań zalogowanego użytkownika wraz z nazwą projektu.
- Edycja danych zadania.
- Usuwanie zadania po zaakceptowaniu okna potwierdzenia.

Priorytety: **Niski**, **Normalny**, **Wysoki**. Statusy: **Do zrobienia**, **Realizowane**, **Wykonane**.

### Projekty

- Tworzenie projektu z nazwą i opcjonalnym opisem.
- Lista własnych projektów i przypisanych do nich zadań.
- Wykres kołowy przedstawiający podział zadań według statusu.
- Edycja nazwy oraz opisu projektu.
- Usuwanie projektu razem ze wszystkimi jego zadaniami po potwierdzeniu.

Backend sprawdza właściciela projektu. Usunięcie zadań i projektu odbywa się w jednej transakcji: błąd powoduje wycofanie operacji. Okno potwierdzenia jest elementem interfejsu, a kontrola dostępu działa niezależnie po stronie API.

### Raporty

Panel raportów znajduje się na stronie zadań. Umożliwia pobranie raportu **PDF** lub **CSV** oraz podgląd wygenerowanego PDF w przeglądarce.

Raport zawiera nazwę zadania, projekt, termin, priorytet, status i opis. Zakres dat dotyczy **terminu zadania**, a nie daty jego utworzenia. Granice zakresu są włączone. Pusta granica nie ogranicza zakresu z tej strony. Zadania bez terminu są pomijane. Raport powstaje w przeglądarce na podstawie już pobranej listy zadań.

### Panel użytkownika

Kliknięcie nazwy użytkownika w nawigacji otwiera panel z edycją loginu, emaila, imienia i nazwiska. Osobny formularz pozwala zmienić hasło po podaniu obecnego hasła oraz potwierdzeniu nowego.

Zmiany danych są przekazywane do Keycloak i lokalnej tabeli `users`. Zmiana emaila usuwa poprzednie oznaczenie emaila jako zweryfikowanego. Hasła użytkowników nie są przechowywane w MySQL aplikacji.

Widok administracyjny jest dostępny dla roli `admin`, ale komponent `Users.jsx` zawiera obecnie tylko miejsce na przyszły panel zarządzania użytkownikami.

## Technologie

| Warstwa | Rozwiązanie |
| --- | --- |
| Interfejs | React 19, React Router 7, Vite 8 |
| Żądania HTTP | Axios i wspólna funkcja `apiFetch` |
| Wykresy | Recharts |
| Raporty | pdfmake, PDF.js (`pdfjs-dist`) |
| Backend | Symfony 7.4, PHP 8.3 w Dockerze |
| Baza aplikacji | MySQL 8.4, PDO |
| Konta i logowanie | Keycloak 26.0.8, OpenID Connect, `keycloak-js` |
| Baza Keycloak | PostgreSQL 16 |
| Weryfikacja JWT | `firebase/php-jwt` |
| Serwowanie frontendu | Nginx |
| Podgląd bazy | phpMyAdmin |
| Środowisko | Docker Compose |

Dokładne wersje zależności zapisane są w plikach `composer.lock` i `package-lock.json`.

## Adresy stron

| Adres | Widok |
| --- | --- |
| `/tasks` | Zadania i raporty |
| `/projects` | Projekty |
| `/panel` | Panel użytkownika |
| `/admin`, `/users` | Widok administracyjny z kontrolą uprawnień |

Adresy `/`, `/index` i `/index.html` przekierowują do `/tasks`. Adres `/usermenu` przekierowuje do `/panel`. Przekierowania React działają po zakończeniu logowania i ustanowieniu sesji aplikacji.

Aktywnym komponentem aplikacji jest **`BffApp.jsx`**, importowany przez `main.jsx`. Plik `App.jsx` pozostaje w repozytorium, ale nie jest obecnym punktem wejścia interfejsu.

## Logowanie, sesja i MFA

1. `main.jsx` uruchamia klienta Keycloak w trybie `login-required` z PKCE S256.
2. Po logowaniu `BffApp.jsx` przekazuje tokeny do `POST /auth/session`.
3. Backend sprawdza token dostępu, token ID, zgodność użytkownika oraz wymaganie MFA. Rejestruje użytkownika w lokalnej bazie i odnawia identyfikator sesji.
4. Tokeny są zapisywane w sesji backendu. Przeglądarka korzysta dalej z ciasteczka **`TODOSESSID`**, oznaczonego jako HttpOnly i SameSite=Lax.
5. Odpowiedź sesji zawiera token CSRF. `api.js` dodaje go jako `X-CSRF-Token` do żądań zmieniających dane. Backend sprawdza również nagłówek `Origin`.
6. Backend odświeża token dostępu przy użyciu tokenu odświeżania. Wylogowanie unieważnia sesję aplikacji i przekierowuje do wylogowania Keycloak.

API korzysta obecnie z sesji. Sam nagłówek `Authorization: Bearer ...` nie zastępuje zalogowanej sesji. Tokeny są jednak dostępne w pamięci przeglądarki podczas inicjalizacji przez `keycloak-js`; aplikacja nie realizuje całego logowania wyłącznie po stronie serwera.

### Obecne wymaganie MFA

Backend wymaga dodatkowego uwierzytelnienia: akceptowanego `acr` z `KEYCLOAK_MFA_ACR_VALUES` lub jednej z wartości `amr`: `otp`, `mfa`, `hwk`, `swk`. Domyślne wymagane ACR to `2`. Przy odpowiedzi 403 podczas ustanawiania sesji interfejs wyświetla ekran ponownej weryfikacji MFA.

Aktualny plik realm zawiera standardowy przepływ `browser`, formularz hasła oraz warunkowy krok OTP. Warunkowy OTP nie oznacza, że każde konto automatycznie spełnia wymagania backendu. Konfiguracja Keycloak musi rzeczywiście zapewniać wymaganą metodę uwierzytelnienia i odpowiednie informacje w tokenie. Samo ustawienie zmiennej ACR nie konfiguruje MFA.

Usunięte rozszerzenie Java `todo-email-otp` nie jest częścią aktualnego obrazu Keycloak. Nie należy mylić dawnych kodów email ze standardowym OTP z aplikacji uwierzytelniającej. Pozostałe pliki szablonów email OTP nie uruchamiają samodzielnie tej funkcji.

## Uruchomienie przez Docker

Wymagane są Docker z obsługą Linux containers i Docker Compose. Polecenia wykonuj w głównym katalogu projektu.

### 1. Konfiguracja środowiska

Jeśli nie masz jeszcze `.env`, skopiuj przykład:

```powershell
Copy-Item .env.example .env
```

Nie nadpisuj istniejącego `.env`, jeśli zawiera konfigurację działających baz. Ustaw własne hasła oraz długi losowy `APP_SECRET`. Nie umieszczaj rzeczywistych sekretów w repozytorium.

| Zmienna | Przeznaczenie |
| --- | --- |
| `APP_DB_NAME`, `APP_DB_USER`, `APP_DB_PASSWORD` | Baza aplikacji i jej użytkownik |
| `APP_DB_ROOT_PASSWORD` | Hasło administratora MySQL przy inicjalizacji |
| `KC_DB_USER`, `KC_DB_PASSWORD` | Użytkownik bazy PostgreSQL Keycloak |
| `KC_ADMIN_USER`, `KC_ADMIN_PASSWORD` | Administrator Keycloak; używany też przez backend do edycji kont |
| `APP_SECRET` | Sekret Symfony |
| `FRONTEND_ORIGIN` | Adres aplikacji, domyślnie `http://localhost:3000` |
| `COOKIE_SECURE` | `false` dla lokalnego HTTP; przy HTTPS ustaw `true` |
| `KEYCLOAK_PUBLIC_URL` | Adres Keycloak dostępny z przeglądarki |
| `KEYCLOAK_REALM` | Realm aplikacji, domyślnie `todo-app` |
| `KEYCLOAK_CLIENT_ID` | Klient, domyślnie `todo-frontend` |
| `KEYCLOAK_ISSUER` | Issuer, domyślnie `http://localhost:8081/realms/todo-app` |
| `KEYCLOAK_MFA_ACR_VALUES` | Akceptowane ACR; obecny przykład wymaga `2` |

Compose ustawia wewnętrzny `KEYCLOAK_URL=http://keycloak:8080` oraz dane połączenia `DB_DSN`, `DB_USER`, `DB_PASSWORD`. `CORS_ALLOW_ORIGIN` pochodzi z `FRONTEND_ORIGIN`. Zmienne `VITE_*` są przekazywane podczas budowania frontendu, więc ich zmiana wymaga przebudowy obrazu.

### 2. Sprawdzenie montowania `db/init.sql`

Aktualny Compose montuje `./db/init.sql` do `/docker-entrypoint-initdb.d/init.sql`. W obecnym katalogu roboczym **`db/init.sql` jest katalogiem, a nie plikiem SQL**.

Przed pierwszym uruchomieniem usuń tę linię montowania z własnej konfiguracji albo zastąp źródło rzeczywistym plikiem SQL. Backend potrafi sam utworzyć brakujące tabele, więc import danych nie jest do tego wymagany. Skrypty inicjalizacyjne obrazu MySQL dotyczą pierwszej inicjalizacji wolumenu, nie każdego restartu.

### 3. Start

```powershell
docker compose config --quiet
docker compose up -d --build
```

| Usługa | Adres |
| --- | --- |
| Aplikacja | http://localhost:3000 |
| API Symfony | http://localhost:8080 |
| Keycloak | http://localhost:8081 |
| phpMyAdmin | http://localhost:8082 |
| MySQL | `localhost:3306` |

Aktualny Compose nie uruchamia Mailpit. Reset hasła przez link jest wyłączony w pliku realm, a działającej wysyłki email nie należy zakładać bez osobnej konfiguracji SMTP.

Nginx przekazuje `/api/` i `/auth/` do backendu, dzięki czemu frontend i API są dostępne dla przeglądarki pod jednym originem. Pozostałe adresy obsługuje React.

### 4. Przebudowa i logi

```powershell
docker compose up -d --build frontend
docker compose up -d --build backend
docker compose logs --tail=100 backend
docker compose logs --tail=100 keycloak
docker compose exec backend php bin/console debug:router
docker compose exec backend php bin/console app:database:init
```

Po przebudowie frontendu odśwież stronę przez Ctrl+F5. W obecnym Compose montowany jest tylko `backend/public`; zmiany `backend/src`, `backend/config`, zależności i Dockerfile wymagają przebudowy backendu.

```powershell
docker compose down
```

Zwykłe `down` zachowuje nazwane wolumeny baz. **Opcja `-v` je usuwa.** Nie jest potrzebna do zwykłego restartu lub aktualizacji aplikacji. Zmiana hasła w `.env` nie zmienia automatycznie hasła użytkownika w już zainicjalizowanej bazie.

## Keycloak i import realm

Compose importuje wyłącznie `keycloak/todo-app-realm.json`. `keycloak/realm-export.json` jest osobnym eksportem i nie jest obecnie montowany jako plik importu.

Importowany realm zawiera klienta aplikacji, role, przykładowe konta i konfigurację przepływów logowania. Nie oznacza to importu projektów i zadań do MySQL.

`start-dev --import-realm` nie aktualizuje automatycznie istniejącego realm. Zmiana pliku JSON i restart mogą więc nie zmienić logowania zapisanego w PostgreSQL. Istniejącą konfigurację należy aktualizować przez panel administratora lub Admin API, zachowując konta. Po usunięciu rozszerzenia Java trzeba osobno sprawdzić, czy zapisany przepływ nadal nie odwołuje się do brakującego providera.

Zmiana nazwy użytkownika zależy również od ustawienia Keycloak **Realm settings → Login → Edit username**. Backend do edycji kont potrzebuje poprawnych danych administratora oraz jego uprawnień. Sprawdzanie obecnego hasła korzysta z klienta `admin-cli` w realm aplikacji i musi być zgodne z jego konfiguracją; dodatkowe wymagania OTP mogą wpływać na ten przepływ.

## Struktura projektu

```text
backend/
  bin/console
  config/
    bootstrap.php
    bundles.php
    routes.yaml
    services.yaml
    packages/framework.yaml
  src/
    Kernel.php
    Controller/
      AuthController.php
      AccountController.php
      TaskController.php
      ProjectController.php
    Repository/TodoRepository.php
    Service/
      Keycloak.php
      Input.php
      ConnectionFactory.php
      Schema.php
    Command/InitializeDatabaseCommand.php
    EventSubscriber/ApiSubscriber.php
  public/
    index.php
    router.php
  tests/integration.php
  composer.json
  composer.lock
  Dockerfile
frontend/
  src/
    main.jsx
    BffApp.jsx
    api.js
    keycloak.js
    App.css
    index.css
    pages/
      Home.jsx
      Projects.jsx
      UserMenu.jsx
      UserMenu.css
      Users.jsx
      ReportPanel.jsx
  index.html
  nginx.conf
  vite.config.js
  Dockerfile
keycloak/
  todo-app-realm.json
  realm-export.json
keycloak-themes/
docker-compose.yml
.env.example
```

- Kontrolery obsługują żądania i odpowiedzi JSON.
- `TodoRepository` zawiera zapytania PDO oraz kontrolę właściciela zasobów.
- `Input` sprawdza dane JSON, długości pól, identyfikatory i daty.
- `Keycloak` obsługuje weryfikację tokenów, sesję, MFA i Admin API.
- `ApiSubscriber` obsługuje CORS i błędy API.
- `Schema` i `ConnectionFactory` obsługują inicjalizację bazy.

Pliki `App.jsx`, `Profile.jsx` i `theme.css` pozostają w repozytorium, ale nie tworzą aktualnego głównego widoku uruchamianego przez `main.jsx`. Stare samodzielne endpointy `addtasks.php`, `showtasks.php`, `edittasks.php`, `deletetasks.php` i `addprojects.php` zostały zastąpione trasami Symfony.

## Baza aplikacji

| Tabela | Kolumny |
| --- | --- |
| `users` | `id`, `keycloak_id`, `username`, `first_name`, `last_name`, `email`, `role`, `created_at`, `last_login` |
| `projects` | `id`, `name`, `description`, `user_id` |
| `tasks` | `id`, `name`, `description`, `deadline`, `created`, `updated`, `priority`, `status`, `user_id`, `project_id` |

Powiązania:

- `users.id` — liczbowy identyfikator z `AUTO_INCREMENT` i unikalnym indeksem.
- `users.keycloak_id` — tekstowy identyfikator Keycloak i klucz główny tabeli.
- `tasks.user_id` — liczbowy `users.id`.
- `projects.user_id` — tekstowy `users.keycloak_id`, zabezpieczony kluczem obcym.
- `tasks.project_id` — identyfikator projektu albo `NULL`; schema nie definiuje tu klucza obcego, a poprawność przypisania sprawdza backend.

`AUTO_INCREMENT` może pozostawiać luki i nie służy do numerowania kolejnych pozycji na liście.

Backend przy starcie kontenera wykonuje `app:database:init`. Przy połączeniu `ConnectionFactory` dodatkowo sprawdza obecność trzech tabel i uzupełnia brakujące. Przy błędzie nieistniejącej bazy MySQL próbuje ją utworzyć, co wymaga odpowiednich uprawnień użytkownika MySQL.

Nowe tabele są puste. Lokalne konto użytkownika jest dodawane podczas ustanawiania sesji lub pierwszego pobrania profilu. Istniejące dane nie są czyszczone. Inicjalizacja uzupełnia wybrane starsze kolumny `users`, ale nie jest pełnym systemem migracji. Backend korzysta z PDO, nie z Doctrine ORM.

## API

Żądania aplikacji są kierowane przez Nginx na porcie 3000. Wymagają aktywnej sesji. Operacje zmieniające dane wymagają również prawidłowego `Origin` i `X-CSRF-Token`, poza ustanawianiem sesji, które ma własną weryfikację originu.

| Metoda | Adres | Działanie |
| --- | --- | --- |
| POST | `/auth/session` | Weryfikacja tokenów i ustanowienie sesji |
| GET | `/auth/me` | Informacje o sesji i token CSRF |
| POST | `/auth/logout` | Unieważnienie sesji i uzyskanie adresu wylogowania Keycloak |
| GET | `/api/me` | Pobranie lokalnego profilu, rejestracja konta przy pierwszym użyciu |
| PUT | `/api/me` | Zmiana loginu, emaila, imienia i nazwiska |
| PUT | `/api/me/password` | Zmiana hasła |
| GET | `/api/tasks` | Lista własnych zadań |
| POST | `/api/tasks` | Dodanie zadania |
| PUT | `/api/tasks/{id}` | Edycja własnego zadania, w tym projektu |
| DELETE | `/api/tasks/{id}` | Usunięcie własnego zadania |
| GET | `/api/projects` | Lista własnych projektów |
| POST | `/api/projects` | Dodanie projektu |
| PUT | `/api/projects/{id}` | Edycja nazwy i opisu projektu |
| DELETE | `/api/projects/{id}` | Usunięcie projektu i jego zadań |
| GET | `/api/admin` | Sprawdzenie roli administratora |

Przykład danych projektu:

```json
{
  "name": "Praktyki",
  "description": "Zadania do wykonania podczas praktyk"
}
```

Przykład danych zadania:

```json
{
  "name": "Przygotować dokumentację",
  "description": "Opisać aktualne działanie aplikacji",
  "deadline": "2026-10-20",
  "priority": "Normalny",
  "status": "Do zrobienia",
  "project_id": null
}
```

API zadań przyjmuje `description` lub starsze pole `desc`. Priorytet i status mogą mieć pełną nazwę albo indeks od zera w podanych wcześniej listach. Nazwa zadania i projektu ma maksymalnie 100 znaków. Data musi być poprawna i mieć format `YYYY-MM-DD`. Pominięcie `project_id` przy edycji zachowuje dotychczasowe przypisanie; `null` je usuwa.

Błędy mają postać `{"error":"komunikat"}`. Typowe kody to 400 dla błędnych danych, 401 dla brakującej lub wygasłej sesji, 403 dla braku MFA, uprawnień lub nieprawidłowej ochrony CSRF, 404 dla brakującego albo niedostępnego zasobu oraz 500/502/503 dla błędów serwera lub usług. Szczegóły techniczne należy sprawdzać w logach backendu.

## Praca lokalna i sprawdzanie zmian

Do pracy poza Dockerem potrzebne są PHP co najmniej 8.2, Composer, rozszerzenia wymagane przez pakiety Symfony, PDO MySQL, dostępny MySQL i Keycloak. Testy korzystają dodatkowo z PDO SQLite. Frontend wymaga Node.js zgodnego z Vite; obraz używa Node.js 22.

```powershell
cd backend
composer install
```

Backend ładuje `backend/.env`, a gdy go nie ma — `backend/.env.dist`. Obecny `.env.dist` nie zawiera wszystkich zmiennych nowszej obsługi sesji. Przy pracy lokalnej trzeba dopisać co najmniej `COOKIE_SECURE`, `FRONTEND_ORIGIN` i `KEYCLOAK_MFA_ACR_VALUES`, a także skonfigurować bazę, Keycloak oraz sekret. Poza Dockerem te wartości nie są automatycznie pobierane z głównego `.env` przez Compose.

```powershell
php bin/console debug:router
php bin/console lint:container
php bin/console lint:yaml config
php bin/console app:database:init
php -S localhost:8080 -t public public/router.php
```

Frontend:

```powershell
cd frontend
npm ci
npm run build
npm run lint
npm run dev
```

Vite używa portu 3000 i przekazuje `/api` oraz `/auth` do `http://localhost:8080`. Dla lokalnego uruchamiania ustaw zmienne frontendu `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM` i `VITE_KEYCLOAK_CLIENT_ID`; opcjonalne `VITE_KEYCLOAK_MFA_ACR` domyślnie wynosi `2`.

### Obecny stan testów

W repozytorium jest skrypt `backend/tests/integration.php` oparty na SQLite i zastępczym kliencie HTTP Keycloak. Obejmuje operacje zadań i projektów, kontrolę właściciela oraz wycofanie transakcji przy błędzie usuwania projektu.

**Skrypt nadal wysyła token Bearer, a aktualne API używa sesji i CSRF.** Nie jest więc obecnie pełnym, dostosowanym testem aktualnego logowania. Może również zatrzymać się na brakujących zmiennych środowiskowych. Wcześniejszych wyników testów nie należy traktować jako potwierdzenia działania obecnej wersji uwierzytelniania.

### Sprawdzenie ręczne

1. Zaloguj się i przejdź wymagane MFA.
2. Sprawdź, czy wejście na `/` kończy się pod `/tasks`.
3. Dodaj projekt, zmień jego nazwę i opis, a następnie anuluj inną edycję.
4. Dodaj zadania z projektem i bez projektu; sprawdź też zmianę projektu podczas edycji.
5. Anuluj usunięcie zadania i upewnij się, że pozostało na liście; następnie potwierdź usunięcie.
6. Usuń projekt z zadaniami po potwierdzeniu i sprawdź, czy inne zadania pozostały.
7. Zaloguj się na inne konto i sprawdź odrębność zasobów.
8. Wygeneruj PDF i CSV dla zakresu terminów.
9. Sprawdź zmianę danych profilu, zmianę hasła i wylogowanie.

## Rozwiązywanie problemów

| Objaw | Co sprawdzić |
| --- | --- |
| Błąd 500 API | `docker compose logs --tail=100 backend`, połączenie z bazą i inicjalizację tabel |
| Brak tabel | `docker compose exec backend php bin/console app:database:init` i uprawnienia MySQL |
| Ekran wymagający MFA | Konfigurację OTP, claimy `acr`/`amr` i mapery klienta w Keycloak |
| „Nieprawidłowe dane logowania” | Konto, hasło i aktualny przepływ w istniejącym realm; sam log `invalid_user_credentials` nie wyjaśnia całej przyczyny |
| Błąd usuniętego providera | Pozostały krok `todo-email-otp` w zapisanej konfiguracji Keycloak |
| Błąd 403 przy zapisie | Sesję, CSRF, origin oraz dostęp do zasobu |
| Zmiany interfejsu niewidoczne | Przebudowę frontendu i odświeżenie Ctrl+F5 |
| Błąd profilu lub hasła | Konfigurację Admin API, administratora, klienta `admin-cli` oraz wymagania uwierzytelniania konta |

## Ograniczenia aktualnej wersji

- Panel zarządzania użytkownikami nie jest zaimplementowany.
- Aktualny backend wymaga MFA, a spójność tej konfiguracji z działającym realm wymaga osobnego sprawdzenia.
- Zmiana profilu obejmuje Keycloak i MySQL bez wspólnej transakcji między tymi systemami.
- Nazwa w nawigacji może wymagać ponownego logowania po zmianie profilu.
- Reset hasła przez email jest wyłączony w pliku importu realm.
- Testy uwierzytelniania wymagają aktualizacji do sesji i CSRF.
- PHP działa na serwerze deweloperskim, a Keycloak w trybie `start-dev`; to konfiguracja do pracy lokalnej.
- Obecny `db/init.sql` wymaga uporządkowania przed inicjalizacją nowego środowiska.

Przy tej aktualizacji dokumentacji nie uruchamiano pełnego środowiska Docker ani testu logowania na rzeczywistym Keycloak. Zmieniony został wyłącznie plik dokumentacji.
