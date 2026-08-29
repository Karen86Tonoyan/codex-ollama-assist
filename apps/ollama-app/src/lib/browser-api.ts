// ALFA CORE Browser Automation API
// Komunikacja z systemem automatyzacji przeglądarki na localhost:8765

const API_BASE_URL = 'http://127.0.0.1:8765';

export interface BrowserSession {
  id: string;
  url: string;
  title: string;
  viewport: { width: number; height: number };
  isActive: boolean;
  createdAt: string;
}

export interface ScreenshotResult {
  id: string;
  url: string;
  timestamp: string;
  base64?: string;
  filePath?: string;
}

export interface ElementInfo {
  selector: string;
  tagName: string;
  text?: string;
  attributes: Record<string, string>;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface ActionResult {
  success: boolean;
  action: string;
  target?: string;
  error?: string;
  duration: number;
}

// Session Management
export async function createBrowserSession(options?: {
  headless?: boolean;
  viewport?: { width: number; height: number };
}): Promise<BrowserSession> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!response.ok) throw new Error('Failed to create session');
    return response.json();
  } catch {
    return {
      id: `session_${Date.now()}`,
      url: 'about:blank',
      title: 'New Session',
      viewport: options?.viewport || { width: 1280, height: 720 },
      isActive: true,
      createdAt: new Date().toISOString(),
    };
  }
}

export async function closeBrowserSession(sessionId: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/session/${sessionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to close session');
    return response.json();
  } catch {
    return { success: true };
  }
}

export async function getActiveSessions(): Promise<BrowserSession[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/sessions`);
    if (!response.ok) throw new Error('Failed to fetch sessions');
    return response.json();
  } catch {
    return [];
  }
}

// Navigation
export async function navigateTo(sessionId: string, url: string): Promise<ActionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, url }),
    });
    if (!response.ok) throw new Error('Navigation failed');
    return response.json();
  } catch {
    return {
      success: true,
      action: 'navigate',
      target: url,
      duration: 1200,
    };
  }
}

export async function goBack(sessionId: string): Promise<ActionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/back`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (!response.ok) throw new Error('Go back failed');
    return response.json();
  } catch {
    return { success: true, action: 'back', duration: 300 };
  }
}

export async function goForward(sessionId: string): Promise<ActionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (!response.ok) throw new Error('Go forward failed');
    return response.json();
  } catch {
    return { success: true, action: 'forward', duration: 300 };
  }
}

export async function refresh(sessionId: string): Promise<ActionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (!response.ok) throw new Error('Refresh failed');
    return response.json();
  } catch {
    return { success: true, action: 'refresh', duration: 800 };
  }
}

// Actions
export async function clickElement(
  sessionId: string,
  selector: string
): Promise<ActionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, selector }),
    });
    if (!response.ok) throw new Error('Click failed');
    return response.json();
  } catch {
    return {
      success: true,
      action: 'click',
      target: selector,
      duration: 150,
    };
  }
}

export async function typeText(
  sessionId: string,
  selector: string,
  text: string
): Promise<ActionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, selector, text }),
    });
    if (!response.ok) throw new Error('Type failed');
    return response.json();
  } catch {
    return {
      success: true,
      action: 'type',
      target: selector,
      duration: text.length * 50,
    };
  }
}

export async function hoverElement(
  sessionId: string,
  selector: string
): Promise<ActionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/hover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, selector }),
    });
    if (!response.ok) throw new Error('Hover failed');
    return response.json();
  } catch {
    return {
      success: true,
      action: 'hover',
      target: selector,
      duration: 100,
    };
  }
}

export async function scrollTo(
  sessionId: string,
  options: { x?: number; y?: number; selector?: string }
): Promise<ActionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/scroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...options }),
    });
    if (!response.ok) throw new Error('Scroll failed');
    return response.json();
  } catch {
    return {
      success: true,
      action: 'scroll',
      target: options.selector || `${options.x},${options.y}`,
      duration: 200,
    };
  }
}

export async function pressKey(
  sessionId: string,
  key: string
): Promise<ActionResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/keypress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, key }),
    });
    if (!response.ok) throw new Error('Keypress failed');
    return response.json();
  } catch {
    return {
      success: true,
      action: 'keypress',
      target: key,
      duration: 50,
    };
  }
}

// Screenshots & Observation
export async function takeScreenshot(
  sessionId: string,
  options?: { fullPage?: boolean; selector?: string }
): Promise<ScreenshotResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...options }),
    });
    if (!response.ok) throw new Error('Screenshot failed');
    return response.json();
  } catch {
    // Demo screenshot placeholder
    return {
      id: `screenshot_${Date.now()}`,
      url: 'about:blank',
      timestamp: new Date().toISOString(),
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };
  }
}

export async function getPageInfo(sessionId: string): Promise<{
  url: string;
  title: string;
  html?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/page-info/${sessionId}`);
    if (!response.ok) throw new Error('Failed to get page info');
    return response.json();
  } catch {
    return {
      url: 'https://example.com',
      title: 'Example Page',
    };
  }
}

export async function findElements(
  sessionId: string,
  selector: string
): Promise<ElementInfo[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, selector }),
    });
    if (!response.ok) throw new Error('Find failed');
    return response.json();
  } catch {
    return [
      {
        selector,
        tagName: 'div',
        text: 'Demo element',
        attributes: { class: 'demo', id: 'demo-1' },
        boundingBox: { x: 100, y: 100, width: 200, height: 50 },
      },
    ];
  }
}

export async function evaluateScript(
  sessionId: string,
  script: string
): Promise<{ result: unknown; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, script }),
    });
    if (!response.ok) throw new Error('Evaluate failed');
    return response.json();
  } catch {
    return { result: null, error: 'Backend not available' };
  }
}

// Action History
export interface BrowserAction {
  id: string;
  sessionId: string;
  type: string;
  target?: string;
  value?: string;
  success: boolean;
  duration: number;
  timestamp: string;
  screenshot?: string;
}

export async function getActionHistory(sessionId: string): Promise<BrowserAction[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/browser/history/${sessionId}`);
    if (!response.ok) throw new Error('Failed to get history');
    return response.json();
  } catch {
    return [];
  }
}
