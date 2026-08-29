# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## App Builder – Ollama + Briefcase

Panel **App Builder** pozwala generować kod Pythona przez Ollama i budować natywne aplikacje (macOS, Windows, Linux, iOS, Android) przez [Briefcase](https://github.com/beeware/briefcase).

### Wymagania

1. **Ollama** – lokalna instancja LLM  
   ```bash
   # Instalacja: https://ollama.com
   ollama pull codellama  # lub inny model
   ```

2. **Briefcase** – narzędzie do pakowania Pythona w natywne apki  
   ```bash
   pip install briefcase
   ```

3. **Backend ALFA** – serwer API (FastAPI) obsługujący endpointy:
   - `GET  /api/briefcase/status` – sprawdza czy Briefcase jest zainstalowany
   - `POST /api/briefcase/projects` – tworzy nowy projekt (`{ name, template }`)
   - `PUT  /api/briefcase/projects/:id/files` – aktualizuje pliki projektu
   - `POST /api/briefcase/projects/:id/build` – buduje na wybraną platformę (`{ platform }`)
   - `POST /api/briefcase/projects/:id/run` – uruchamia projekt
   - `GET  /api/briefcase/projects/:id/export` – eksportuje jako ZIP
   - `DELETE /api/briefcase/projects/:id` – usuwa projekt
   - `POST /api/exec` – wykonuje komendę PowerShell/Bash (`{ command, cwd?, timeout?, shell? }`)
   - `POST /api/exec/briefcase` – pipeline Briefcase (`{ action, platform, project_dir? }`)

   Backend nasłuchuje domyślnie na `http://localhost:8765` (API) i `http://localhost:11434` (Ollama).

### Agent Auto-Executor

Agent ALFA automatycznie wykrywa komendy w odpowiedziach AI i wykonuje je w PowerShell/Bash:

1. Włącz **Agent Auto-Exec** w ustawieniach chatu (domyślnie ON)
2. Napisz do AI np. "zainstaluj briefcase i zbuduj aplikację kalkulator na Windows"
3. AI wygeneruje plan z komendami
4. Agent **automatycznie** wykona każdą komendę w PowerShell
5. Wyniki pojawiają się w chacie jako raport

**Wykrywane wzorce komend:**
- Bloki kodu ` ```powershell ` / ` ```bash `
- Linie zaczynające się od `$` lub `>`
- Komendy `briefcase`, `pip install`, `python`, `npm`

**Zabezpieczenia:**
- Blacklista niebezpiecznych komend (`rm -rf /`, `format`, `shutdown`...)
- Timeout (domyślnie 60s, max 300s)
- Możliwość wyłączenia auto-exec w ustawieniach

### Jak używać

1. Otwórz zakładkę **App Builder** w interfejsie ALFA
2. Utwórz nowy projekt (nazwa + szablon: Toga GUI / Console / Flask API)
3. Opisz aplikację w polu promptu – Ollama wygeneruje kod
4. Edytuj wygenerowane pliki w edytorze kodu
5. Wybierz platformę docelową i kliknij **Build**
6. Pobierz gotową aplikację przez **Export**

### Szablony

| Szablon | Opis |
|---------|------|
| **Toga GUI** | Aplikacja desktopowa z natywnym GUI (BeeWare/Toga) |
| **Console** | Aplikacja konsolowa CLI |
| **Flask API** | Serwer webowy REST API |

---

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
