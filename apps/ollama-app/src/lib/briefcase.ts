// Briefcase CLI API Client
// Komunikacja z lokalnym backendem do zarządzania projektami Briefcase

const API_BASE_URL = 'http://127.0.0.1:8765';

export interface BriefcaseProject {
  id: string;
  name: string;
  appName: string;
  bundleId: string;
  description: string;
  template: 'toga' | 'console' | 'flask';
  platforms: ('macOS' | 'windows' | 'linux' | 'iOS' | 'android')[];
  createdAt: string;
  status: 'draft' | 'created' | 'building' | 'built' | 'error';
  files: ProjectFile[];
}

export interface ProjectFile {
  path: string;
  content: string;
  language: string;
}

export interface BuildResult {
  success: boolean;
  platform: string;
  outputPath?: string;
  logs: string[];
  error?: string;
}

export interface BriefcaseStatus {
  installed: boolean;
  version?: string;
  pythonVersion?: string;
  availablePlatforms: string[];
}

export interface ExecResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  command: string;
  duration_ms: number;
}

// Execute a shell/PowerShell command
export async function execCommand(
  command: string,
  options?: { cwd?: string; timeout?: number; shell?: string }
): Promise<ExecResult> {
  const response = await fetch(`${API_BASE_URL}/api/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command,
      cwd: options?.cwd,
      timeout: options?.timeout || 60,
      shell: options?.shell || 'auto',
    }),
  });
  if (!response.ok) throw new Error('Exec failed');
  return response.json();
}

// Execute Briefcase pipeline action
export type BriefcaseAction = 'install' | 'new' | 'create' | 'build' | 'run' | 'dev' | 'update' | 'package';

export async function execBriefcasePipeline(
  action: BriefcaseAction,
  options?: { platform?: string; project_dir?: string; extra_args?: string }
): Promise<ExecResult & { action: string }> {
  const response = await fetch(`${API_BASE_URL}/api/exec/briefcase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      platform: options?.platform || 'windows',
      project_dir: options?.project_dir,
      extra_args: options?.extra_args,
    }),
  });
  if (!response.ok) throw new Error('Briefcase pipeline failed');
  return response.json();
}

// Check if Briefcase is available
export async function checkBriefcase(): Promise<BriefcaseStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/briefcase/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error('Briefcase not available');
    return response.json();
  } catch {
    return {
      installed: false,
      availablePlatforms: [],
    };
  }
}

// Create a new Briefcase project
export async function createProject(project: {
  name: string;
  appName: string;
  bundleId: string;
  description: string;
  template: string;
}): Promise<BriefcaseProject> {
  const response = await fetch(`${API_BASE_URL}/api/briefcase/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!response.ok) throw new Error('Failed to create project');
  return response.json();
}

// List all projects
export async function listProjects(): Promise<BriefcaseProject[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/briefcase/projects`);
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

// Update project files (from AI-generated code)
export async function updateProjectFiles(
  projectId: string,
  files: ProjectFile[]
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/briefcase/projects/${projectId}/files`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  });
  if (!response.ok) throw new Error('Failed to update files');
}

// Build project for a platform
export async function buildProject(
  projectId: string,
  platform: string,
  onLog?: (log: string) => void
): Promise<BuildResult> {
  const response = await fetch(`${API_BASE_URL}/api/briefcase/projects/${projectId}/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform }),
  });

  if (!response.ok) throw new Error('Build failed');

  // Stream logs if available
  if (response.body && onLog) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      result += chunk;
      onLog(chunk);
    }

    return JSON.parse(result);
  }

  return response.json();
}

// Run project locally
export async function runProject(projectId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/briefcase/projects/${projectId}/run`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to run project');
  return response.json();
}

// Export project as ZIP
export async function exportProject(projectId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/briefcase/projects/${projectId}/export`);
  if (!response.ok) throw new Error('Export failed');
  return response.blob();
}

// Delete project
export async function deleteProject(projectId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/briefcase/projects/${projectId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Delete failed');
}

// Generate code using Ollama
export async function generateAppCode(
  prompt: string,
  model: string,
  template: string,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const systemPrompt = `Jesteś ekspertem Python tworzącym aplikacje z użyciem BeeWare/Briefcase.
Szablon: ${template}.
${template === 'toga' ? 'Użyj biblioteki Toga do GUI. Importuj toga i twórz widgety.' : ''}
${template === 'console' ? 'Stwórz aplikację konsolową z __main__.py.' : ''}
${template === 'flask' ? 'Stwórz aplikację Flask jako backend.' : ''}

Generuj TYLKO kod Python, bez komentarzy poza docstringami.
Odpowiadaj w formacie:
---FILE: ścieżka/do/pliku.py---
<kod>
---END FILE---

Dla każdego pliku osobno.`;

  const response = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      stream: !!onChunk,
    }),
  });

  if (!response.ok) throw new Error('Code generation failed');

  if (onChunk && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      
      try {
        const lines = chunk.split('\n').filter(Boolean);
        for (const line of lines) {
          const json = JSON.parse(line);
          if (json.message?.content) {
            fullContent += json.message.content;
            onChunk(json.message.content);
          }
        }
      } catch { /* partial JSON */ }
    }

    return fullContent;
  }

  const data = await response.json();
  return data.message?.content || '';
}

// Parse generated code into files
export function parseGeneratedFiles(rawCode: string): ProjectFile[] {
  const files: ProjectFile[] = [];
  const fileRegex = /---FILE:\s*(.+?)---\n([\s\S]*?)---END FILE---/g;
  
  let match;
  while ((match = fileRegex.exec(rawCode)) !== null) {
    const path = match[1].trim();
    const content = match[2].trim();
    const ext = path.split('.').pop() || 'py';
    
    files.push({
      path,
      content,
      language: ext === 'py' ? 'python' : ext,
    });
  }

  // If no file markers found, treat entire content as app.py
  if (files.length === 0 && rawCode.trim()) {
    files.push({
      path: 'app.py',
      content: rawCode.trim(),
      language: 'python',
    });
  }

  return files;
}
