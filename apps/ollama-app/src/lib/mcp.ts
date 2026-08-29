// MCP (Model Context Protocol) Client for ALFA Overlay
// Obsługa serwerów MCP i ich narzędzi

const API_BASE_URL = 'http://127.0.0.1:8765';

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  status: 'connected' | 'disconnected' | 'error';
  tools: MCPTool[];
  description?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, {
      type: string;
      description?: string;
      required?: boolean;
    }>;
    required?: string[];
  };
}

export interface MCPToolResult {
  success: boolean;
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }[];
  error?: string;
}

// Token pricing for cost estimation (per 1M tokens)
export const TOKEN_PRICING: Record<string, { input: number; output: number; context: number }> = {
  'ollama-deepseek': { input: 0, output: 0, context: 128000 },
  'ollama-llama3': { input: 0, output: 0, context: 128000 },
  'gemini-pro': { input: 1.25, output: 5.0, context: 1000000 },
  'gemini-flash': { input: 0.075, output: 0.3, context: 1000000 },
  'gpt-4': { input: 30.0, output: 60.0, context: 128000 },
  'gpt-4-turbo': { input: 10.0, output: 30.0, context: 128000 },
  'gpt-4o': { input: 2.5, output: 10.0, context: 128000 },
  'gpt-4o-mini': { input: 0.15, output: 0.6, context: 128000 },
  'claude-sonnet': { input: 3.0, output: 15.0, context: 200000 },
  'claude-opus': { input: 15.0, output: 75.0, context: 200000 },
  'claude-haiku': { input: 0.25, output: 1.25, context: 200000 },
  'deepseek-r1': { input: 0.55, output: 2.19, context: 128000 },
  'deepseek-v3': { input: 0.27, output: 1.10, context: 64000 },
};

// Estimate token count from text
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English, ~2 for code
  const hasCode = /```|function|const|class|import|export/.test(text);
  const charsPerToken = hasCode ? 3 : 4;
  return Math.ceil(text.length / charsPerToken);
}

// Calculate cost for tokens
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = TOKEN_PRICING[model] || { input: 0, output: 0, context: 128000 };
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}

// Get context window size for model
export function getContextWindow(model: string): number {
  return TOKEN_PRICING[model]?.context || 128000;
}

// Format cost as string
export function formatCost(cost: number): string {
  if (cost === 0) return 'Darmowy';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

// MCP Server Management
export async function getMCPServers(): Promise<MCPServer[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mcp/servers`);
    if (!response.ok) throw new Error('Failed to fetch MCP servers');
    return response.json();
  } catch {
    // Return demo servers when backend is unavailable
    return [
      {
        id: 'blueprint-mcp',
        name: 'Blueprint MCP',
        url: 'http://localhost:8765',
        status: 'disconnected',
        description: 'Automatyzacja przeglądarki - 40+ narzędzi do kontroli, nawigacji i ekstrakcji',
        tools: [
          // Session Management
          { name: 'browser_create_session', description: 'Utwórz nową sesję przeglądarki', inputSchema: { type: 'object', properties: { headless: { type: 'boolean', description: 'Tryb bez interfejsu graficznego' }, viewport_width: { type: 'number', description: 'Szerokość okna' }, viewport_height: { type: 'number', description: 'Wysokość okna' } }, required: [] } },
          { name: 'browser_close_session', description: 'Zamknij sesję przeglądarki', inputSchema: { type: 'object', properties: { session_id: { type: 'string', description: 'ID sesji' } }, required: ['session_id'] } },
          { name: 'browser_list_sessions', description: 'Lista aktywnych sesji', inputSchema: { type: 'object', properties: {}, required: [] } },
          { name: 'browser_get_session_info', description: 'Informacje o sesji', inputSchema: { type: 'object', properties: { session_id: { type: 'string', description: 'ID sesji' } }, required: ['session_id'] } },
          
          // Navigation
          { name: 'browser_navigate', description: 'Nawiguj do URL', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, url: { type: 'string', description: 'Adres URL' } }, required: ['session_id', 'url'] } },
          { name: 'browser_go_back', description: 'Wróć do poprzedniej strony', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_go_forward', description: 'Przejdź do następnej strony', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_refresh', description: 'Odśwież stronę', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_get_url', description: 'Pobierz aktualny URL', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          
          // Actions - Click
          { name: 'browser_click', description: 'Kliknij element', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string', description: 'Selektor CSS' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_double_click', description: 'Podwójne kliknięcie', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_right_click', description: 'Kliknięcie prawym przyciskiem', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_click_coordinates', description: 'Kliknij w współrzędne X,Y', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['session_id', 'x', 'y'] } },
          
          // Actions - Input
          { name: 'browser_type', description: 'Wpisz tekst w element', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' }, text: { type: 'string', description: 'Tekst do wpisania' } }, required: ['session_id', 'selector', 'text'] } },
          { name: 'browser_fill', description: 'Wypełnij pole formularza', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' }, value: { type: 'string' } }, required: ['session_id', 'selector', 'value'] } },
          { name: 'browser_clear', description: 'Wyczyść pole tekstowe', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_press_key', description: 'Naciśnij klawisz (Enter, Tab, Escape...)', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, key: { type: 'string', description: 'Nazwa klawisza' } }, required: ['session_id', 'key'] } },
          { name: 'browser_key_combo', description: 'Kombinacja klawiszy (Ctrl+C, Cmd+V...)', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, keys: { type: 'string', description: 'Np. Control+Shift+A' } }, required: ['session_id', 'keys'] } },
          
          // Actions - Mouse
          { name: 'browser_hover', description: 'Najedź kursorem na element', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_drag_and_drop', description: 'Przeciągnij i upuść', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, source: { type: 'string', description: 'Selektor źródła' }, target: { type: 'string', description: 'Selektor celu' } }, required: ['session_id', 'source', 'target'] } },
          { name: 'browser_scroll', description: 'Przewiń stronę', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } }, required: ['session_id'] } },
          { name: 'browser_scroll_to_element', description: 'Przewiń do elementu', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          
          // Actions - Select & Check
          { name: 'browser_select_option', description: 'Wybierz opcję z listy rozwijanej', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' }, value: { type: 'string' } }, required: ['session_id', 'selector', 'value'] } },
          { name: 'browser_check', description: 'Zaznacz checkbox', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_uncheck', description: 'Odznacz checkbox', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          
          // Actions - Files
          { name: 'browser_upload_file', description: 'Załaduj plik', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' }, file_path: { type: 'string', description: 'Ścieżka do pliku' } }, required: ['session_id', 'selector', 'file_path'] } },
          { name: 'browser_download_file', description: 'Pobierz plik', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, url: { type: 'string' } }, required: ['session_id', 'url'] } },
          
          // Screenshots & Recording
          { name: 'browser_screenshot', description: 'Zrzut ekranu', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, full_page: { type: 'boolean', description: 'Cała strona' }, selector: { type: 'string', description: 'Tylko element' } }, required: ['session_id'] } },
          { name: 'browser_screenshot_element', description: 'Zrzut konkretnego elementu', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_start_recording', description: 'Rozpocznij nagrywanie wideo', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_stop_recording', description: 'Zatrzymaj nagrywanie', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          
          // DOM Inspection
          { name: 'browser_get_html', description: 'Pobierz HTML strony', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string', description: 'Opcjonalny selektor' } }, required: ['session_id'] } },
          { name: 'browser_get_text', description: 'Pobierz tekst elementu', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_get_attribute', description: 'Pobierz atrybut elementu', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' }, attribute: { type: 'string' } }, required: ['session_id', 'selector', 'attribute'] } },
          { name: 'browser_get_value', description: 'Pobierz wartość inputa', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_find_elements', description: 'Znajdź wszystkie pasujące elementy', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_element_exists', description: 'Sprawdź czy element istnieje', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_is_visible', description: 'Sprawdź widoczność elementu', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_get_bounding_box', description: 'Pobierz pozycję i rozmiar elementu', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' } }, required: ['session_id', 'selector'] } },
          
          // JavaScript
          { name: 'browser_evaluate', description: 'Wykonaj JavaScript na stronie', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, script: { type: 'string', description: 'Kod JavaScript' } }, required: ['session_id', 'script'] } },
          { name: 'browser_execute_async', description: 'Wykonaj async JavaScript', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, script: { type: 'string' } }, required: ['session_id', 'script'] } },
          
          // Wait & Timeout
          { name: 'browser_wait_for_element', description: 'Czekaj na element', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, selector: { type: 'string' }, timeout: { type: 'number', description: 'Timeout w ms' } }, required: ['session_id', 'selector'] } },
          { name: 'browser_wait_for_navigation', description: 'Czekaj na nawigację', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, timeout: { type: 'number' } }, required: ['session_id'] } },
          { name: 'browser_wait_for_load', description: 'Czekaj na załadowanie strony', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_sleep', description: 'Pauza (ms)', inputSchema: { type: 'object', properties: { duration: { type: 'number', description: 'Czas w milisekundach' } }, required: ['duration'] } },
          
          // Cookies & Storage
          { name: 'browser_get_cookies', description: 'Pobierz ciasteczka', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_set_cookie', description: 'Ustaw ciasteczko', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, name: { type: 'string' }, value: { type: 'string' }, domain: { type: 'string' } }, required: ['session_id', 'name', 'value'] } },
          { name: 'browser_delete_cookies', description: 'Usuń ciasteczka', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_get_local_storage', description: 'Pobierz localStorage', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, key: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_set_local_storage', description: 'Ustaw localStorage', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, key: { type: 'string' }, value: { type: 'string' } }, required: ['session_id', 'key', 'value'] } },
          
          // Network
          { name: 'browser_intercept_requests', description: 'Przechwytuj żądania HTTP', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, url_pattern: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_get_network_log', description: 'Pobierz log sieci', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_mock_response', description: 'Mockuj odpowiedź HTTP', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, url_pattern: { type: 'string' }, response: { type: 'string' } }, required: ['session_id', 'url_pattern', 'response'] } },
          
          // Dialogs & Alerts
          { name: 'browser_handle_dialog', description: 'Obsłuż dialog (accept/dismiss)', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, action: { type: 'string', description: 'accept lub dismiss' }, prompt_text: { type: 'string' } }, required: ['session_id', 'action'] } },
          
          // Frames & Windows
          { name: 'browser_switch_to_frame', description: 'Przełącz do iframe', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, frame_selector: { type: 'string' } }, required: ['session_id', 'frame_selector'] } },
          { name: 'browser_switch_to_main', description: 'Wróć do głównej ramki', inputSchema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_new_tab', description: 'Otwórz nową kartę', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, url: { type: 'string' } }, required: ['session_id'] } },
          { name: 'browser_switch_tab', description: 'Przełącz kartę', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, tab_index: { type: 'number' } }, required: ['session_id', 'tab_index'] } },
          { name: 'browser_close_tab', description: 'Zamknij kartę', inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, tab_index: { type: 'number' } }, required: ['session_id'] } },
        ],
      },
      {
        id: 'filesystem',
        name: 'File System',
        url: 'http://localhost:3001',
        status: 'disconnected',
        description: 'Dostęp do systemu plików',
        tools: [
          { name: 'read_file', description: 'Odczytaj zawartość pliku', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Ścieżka do pliku' } }, required: ['path'] } },
          { name: 'write_file', description: 'Zapisz zawartość do pliku', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Ścieżka do pliku' }, content: { type: 'string', description: 'Zawartość do zapisania' } }, required: ['path', 'content'] } },
          { name: 'list_directory', description: 'Wylistuj pliki w katalogu', inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Ścieżka do katalogu' } }, required: ['path'] } },
        ],
      },
      {
        id: 'web-search',
        name: 'Web Search',
        url: 'http://localhost:3002',
        status: 'disconnected',
        description: 'Wyszukiwanie w internecie',
        tools: [
          { name: 'search', description: 'Wyszukaj w internecie', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Zapytanie wyszukiwania' }, num_results: { type: 'number', description: 'Liczba wyników' } }, required: ['query'] } },
        ],
      },
      {
        id: 'code-analysis',
        name: 'Code Analysis',
        url: 'http://localhost:3003',
        status: 'disconnected',
        description: 'Analiza i przegląd kodu',
        tools: [
          { name: 'analyze_code', description: 'Analizuj kod źródłowy', inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'Kod do analizy' }, language: { type: 'string', description: 'Język programowania' } }, required: ['code'] } },
          { name: 'find_bugs', description: 'Znajdź błędy w kodzie', inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'Kod do sprawdzenia' } }, required: ['code'] } },
        ],
      },
    ];
  }
}

export async function addMCPServer(name: string, url: string): Promise<MCPServer> {
  const response = await fetch(`${API_BASE_URL}/api/mcp/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, url }),
  });

  if (!response.ok) throw new Error('Failed to add MCP server');
  return response.json();
}

export async function removeMCPServer(serverId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/mcp/servers/${serverId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to remove MCP server');
}

export async function connectMCPServer(serverId: string): Promise<MCPServer> {
  const response = await fetch(`${API_BASE_URL}/api/mcp/servers/${serverId}/connect`, {
    method: 'POST',
  });

  if (!response.ok) throw new Error('Failed to connect to MCP server');
  return response.json();
}

export async function executeMCPTool(
  serverId: string,
  toolName: string,
  params: Record<string, unknown>
): Promise<MCPToolResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/mcp/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId, tool: toolName, params }),
    });

    if (!response.ok) throw new Error('Tool execution failed');
    return response.json();
  } catch (error) {
    return {
      success: false,
      content: [],
      error: error instanceof Error ? error.message : 'Błąd wykonania narzędzia',
    };
  }
}
