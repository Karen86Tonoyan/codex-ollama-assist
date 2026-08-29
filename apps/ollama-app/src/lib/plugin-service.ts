/**
 * Shared Plugin Service
 * Reusable plugin registry, detection, and execution for ChatPanel and PluginsPanel
 */

const PLUGIN_API_URL = 'http://127.0.0.1:8765';

export interface Plugin {
  name: string;
  category: string;
  description: string;
  version: string;
}

export interface PluginResult {
  success: boolean;
  plugin: string;
  result: Record<string, unknown>;
  error?: string;
}

// ── Default plugin registry (fallback when server is offline) ──

const DEFAULT_PLUGINS: Plugin[] = [
  { name: 'pdf-generator', category: 'files', description: 'Generuje PDF z tekstu/markdown', version: '1.0.0' },
  { name: 'doc-converter', category: 'files', description: 'Konwertuje formaty (docx↔pdf↔txt↔md)', version: '1.0.0' },
  { name: 'batch-rename', category: 'files', description: 'Masowa zmiana nazw plików', version: '1.0.0' },
  { name: 'file-organizer', category: 'files', description: 'Sortuje pliki do folderów po typie', version: '1.0.0' },
  { name: 'backup-auto', category: 'files', description: 'Automatyczny backup do folderu/chmury', version: '1.0.0' },
  { name: 'zip-manager', category: 'files', description: 'Pakuje/rozpakowuje archiwa', version: '1.0.0' },
  { name: 'file-watcher', category: 'files', description: 'Monitoruje zmiany w folderach', version: '1.0.0' },
  { name: 'file-sync', category: 'files', description: 'Synchronizacja plików między folderami', version: '1.0.0' },
  { name: 'code-generator', category: 'coding', description: 'Generuje kod z opisu (Python/JS/C#)', version: '1.0.0' },
  { name: 'code-reviewer', category: 'coding', description: 'Sprawdza kod, znajduje błędy i problemy bezpieczeństwa', version: '1.0.0' },
  { name: 'git-auto', category: 'coding', description: 'Auto commit/push/pull z AI wiadomościami', version: '1.0.0' },
  { name: 'docker-builder', category: 'coding', description: 'Generuje Dockerfile z opisu', version: '1.0.0' },
  { name: 'api-tester', category: 'coding', description: 'Testuje endpointy REST', version: '1.0.0' },
  { name: 'env-manager', category: 'coding', description: 'Zarządza zmiennymi środowiskowymi', version: '1.0.0' },
  { name: 'regex-builder', category: 'coding', description: 'Generuje i testuje wyrażenia regularne', version: '1.0.0' },
  { name: 'sql-generator', category: 'coding', description: 'Generuje zapytania SQL z opisu', version: '1.0.0' },
  { name: 'csv-processor', category: 'data', description: 'Przetwarza i filtruje CSV', version: '1.0.0' },
  { name: 'excel-auto', category: 'data', description: 'Automatyzacja Excel (makra)', version: '1.0.0' },
  { name: 'json-transformer', category: 'data', description: 'Konwertuje i mapuje JSON', version: '1.0.0' },
  { name: 'data-scraper', category: 'data', description: 'Scrapuje dane ze stron', version: '1.0.0' },
  { name: 'report-generator', category: 'data', description: 'Generuje raporty z danych', version: '1.0.0' },
  { name: 'chart-creator', category: 'data', description: 'Tworzy wykresy z danych', version: '1.0.0' },
  { name: 'text-summarizer', category: 'ai', description: 'Streszcza długie teksty AI', version: '1.0.0' },
  { name: 'sentiment-analyzer', category: 'ai', description: 'Analiza sentymentu tekstu', version: '1.0.0' },
  { name: 'translator', category: 'ai', description: 'Tłumaczenie tekstu AI (50+ języków)', version: '1.0.0' },
  { name: 'ocr-reader', category: 'ai', description: 'Rozpoznaje tekst z obrazów (OCR)', version: '1.0.0' },
  { name: 'email-sender', category: 'communication', description: 'Wysyła maile (SMTP)', version: '1.0.0' },
  { name: 'telegram-bot', category: 'communication', description: 'Bot Telegram', version: '1.0.0' },
  { name: 'discord-bot', category: 'communication', description: 'Bot Discord', version: '1.0.0' },
  { name: 'image-resizer', category: 'media', description: 'Zmiana rozmiaru i kompresja obrazów', version: '1.0.0' },
  { name: 'password-gen', category: 'security', description: 'Generator silnych haseł', version: '1.0.0' },
  { name: 'port-scanner', category: 'security', description: 'Skanuje otwarte porty', version: '1.0.0' },
  { name: 'ssl-checker', category: 'security', description: 'Sprawdza certyfikaty SSL', version: '1.0.0' },
  { name: 'web-monitor', category: 'web', description: 'Monitoruje strony (zmiany, dostępność)', version: '1.0.0' },
  { name: 'task-scheduler', category: 'automation', description: 'Planowanie zadań cron', version: '1.0.0' },
  { name: 'screen-capture', category: 'automation', description: 'Zrzuty ekranu i nagrywanie', version: '1.0.0' },
];

// ── Plugin Registry (singleton) ──

let _cachedPlugins: Plugin[] = [];

export async function fetchPlugins(): Promise<Plugin[]> {
  try {
    const response = await fetch(`${PLUGIN_API_URL}/api/plugins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_plugins' }),
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      _cachedPlugins = data.plugins || [];
      return _cachedPlugins;
    }
  } catch {
    // fallback
  }
  _cachedPlugins = DEFAULT_PLUGINS;
  return _cachedPlugins;
}

export function getCachedPlugins(): Plugin[] {
  return _cachedPlugins.length > 0 ? _cachedPlugins : DEFAULT_PLUGINS;
}

// ── Plugin Execution ──

export async function executePlugin(
  pluginName: string,
  params: Record<string, unknown> = {}
): Promise<PluginResult> {
  try {
    const response = await fetch(`${PLUGIN_API_URL}/api/plugins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute',
        plugin: pluginName,
        params,
      }),
    });
    return await response.json();
  } catch (error) {
    return {
      success: false,
      plugin: pluginName,
      result: {},
      error: error instanceof Error ? error.message : 'Błąd wykonania pluginu',
    };
  }
}

// ── Chat Command Detection ──

export interface PluginCommand {
  pluginName: string;
  plugin: Plugin | undefined;
  params: Record<string, string>;
  rawArgs: string;
}

/**
 * Parse chat message for plugin commands.
 * Supported patterns:
 *   - "uruchom pdf-generator"
 *   - "plugin: code-reviewer plik=main.py"
 *   - "/plugin pdf-generator content=hello"
 *   - "wykonaj translator tekst='Hello world' język=pl"
 *   - "odpal data-scraper url=https://example.com"
 */
export function parsePluginCommand(message: string): PluginCommand | null {
  const trimmed = message.trim();
  const plugins = getCachedPlugins();

  // Pattern 1: "uruchom/wykonaj/odpal/run <plugin-name> [args]"
  const commandMatch = trimmed.match(
    /^(?:uruchom|wykonaj|odpal|run|plugin:|\/plugin)\s+([\w-]+)(?:\s+(.*))?$/i
  );

  if (commandMatch) {
    const pluginName = commandMatch[1].toLowerCase();
    const argsStr = commandMatch[2] || '';
    const plugin = plugins.find(p => p.name.toLowerCase() === pluginName);

    return {
      pluginName,
      plugin,
      params: parseArgs(argsStr),
      rawArgs: argsStr,
    };
  }

  // Pattern 2: check if any plugin name appears after a trigger word anywhere
  const triggerWords = ['uruchom', 'wykonaj', 'odpal', 'run', 'użyj', 'włącz'];
  const lower = trimmed.toLowerCase();

  for (const trigger of triggerWords) {
    const idx = lower.indexOf(trigger);
    if (idx === -1) continue;

    const afterTrigger = lower.slice(idx + trigger.length).trim();
    const matchedPlugin = plugins.find(p => afterTrigger.startsWith(p.name.toLowerCase()));

    if (matchedPlugin) {
      const argsStr = afterTrigger.slice(matchedPlugin.name.length).trim();
      return {
        pluginName: matchedPlugin.name,
        plugin: matchedPlugin,
        params: parseArgs(argsStr),
        rawArgs: argsStr,
      };
    }
  }

  return null;
}

function parseArgs(argsStr: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!argsStr) return params;

  // Match key=value or key='value with spaces'
  const matches = argsStr.matchAll(/(\w+)\s*=\s*(?:'([^']*)'|"([^"]*)"|(\S+))/g);
  for (const m of matches) {
    params[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }

  // If no key=value found, put everything as 'input'
  if (Object.keys(params).length === 0 && argsStr.trim()) {
    params.input = argsStr.trim();
  }

  return params;
}

/**
 * Format plugin result as a markdown chat message
 */
export function formatPluginResult(result: PluginResult): string {
  if (result.success) {
    const output = Object.keys(result.result).length > 0
      ? '```json\n' + JSON.stringify(result.result, null, 2) + '\n```'
      : '_Wykonano pomyślnie_';

    return `🔌 **Plugin \`${result.plugin}\`** — ✅ Sukces\n\n${output}`;
  }

  return `🔌 **Plugin \`${result.plugin}\`** — ❌ Błąd\n\n\`\`\`\n${result.error || 'Nieznany błąd'}\n\`\`\``;
}

/**
 * Format the "plugin not found" message with suggestions
 */
export function formatPluginNotFound(pluginName: string): string {
  const plugins = getCachedPlugins();
  const suggestions = plugins
    .filter(p => p.name.includes(pluginName) || pluginName.includes(p.name.split('-')[0]))
    .slice(0, 5);

  let msg = `🔌 Plugin **\`${pluginName}\`** nie został znaleziony.`;

  if (suggestions.length > 0) {
    msg += '\n\nCzy chodziło Ci o:\n' +
      suggestions.map(p => `- \`${p.name}\` — ${p.description}`).join('\n');
  }

  msg += '\n\n💡 Wpisz **"lista pluginów"** aby zobaczyć wszystkie dostępne wtyczki.';
  return msg;
}

/**
 * Format plugin list for chat
 */
export function formatPluginList(): string {
  const plugins = getCachedPlugins();
  const byCategory = plugins.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, Plugin[]>);

  const CATEGORY_LABELS: Record<string, string> = {
    files: '📁 Pliki', coding: '💻 Kodowanie', data: '📊 Dane',
    web: '🌐 Web', communication: '💬 Komunikacja', automation: '⚙️ Automatyzacja',
    ai: '🤖 AI/ML', media: '🎨 Media', security: '🔒 Bezpieczeństwo',
  };

  let msg = '## 🔌 Dostępne wtyczki\n\nUżyj: `uruchom <nazwa>` aby uruchomić wtyczkę.\n\n';

  for (const [cat, catPlugins] of Object.entries(byCategory)) {
    msg += `### ${CATEGORY_LABELS[cat] || cat}\n`;
    msg += catPlugins.map(p => `- \`${p.name}\` — ${p.description}`).join('\n');
    msg += '\n\n';
  }

  return msg;
}

/**
 * Check if message is a plugin list request
 */
export function isPluginListRequest(message: string): boolean {
  const lower = message.toLowerCase().trim();
  return /^(lista|pokaż|wyświetl|list)\s*(pluginów|wtyczek|plugins?)$/i.test(lower)
    || lower === 'plugins'
    || lower === 'wtyczki';
}
