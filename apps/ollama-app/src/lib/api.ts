// ALFA CORE API Client
// Komunikacja z lokalnym backendem ALFA Plugin System na localhost:8765

const API_BASE_URL = 'http://127.0.0.1:8765';

export interface Model {
  id: string;
  name: string;
  size?: string;
  modified_at?: string;
}

export interface VoiceTranscription {
  text: string;
  confidence?: number;
}

export interface VisionAnalysis {
  description: string;
  objects?: string[];
  confidence?: number;
}

export interface Workflow {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  steps: WorkflowStep[];
  lastRun?: string;
  interval?: number;
}

export interface WorkflowStep {
  id: string;
  action: string;
  params?: Record<string, unknown>;
}

export interface SystemStatus {
  connected: boolean;
  cpu?: number;
  ram?: number;
  tokensUsed?: number;
  tokensLimit?: number;
}

// Health check - sprawdzenie połączenia z ALFA CORE
export async function checkConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Pobierz listę dostępnych modeli
export async function getModels(): Promise<Model[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/models`);
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}

// Transkrypcja audio na tekst
export async function transcribeAudio(audioBlob: Blob): Promise<VoiceTranscription> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const response = await fetch(`${API_BASE_URL}/api/voice/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Transcription failed');
  return response.json();
}

// Synteza mowy z tekstu
export async function synthesizeSpeech(text: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/voice/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) throw new Error('Speech synthesis failed');
  return response.blob();
}

// Analiza obrazu
export async function analyzeImage(imageBlob: Blob, prompt?: string): Promise<VisionAnalysis> {
  const formData = new FormData();
  formData.append('image', imageBlob, 'capture.jpg');
  if (prompt) formData.append('prompt', prompt);

  const response = await fetch(`${API_BASE_URL}/api/vision/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Image analysis failed');
  return response.json();
}

// Chat z AI
export async function sendChatMessage(message: string, model?: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, model }),
  });

  if (!response.ok) throw new Error('Chat request failed');
  const data = await response.json();
  return data.response;
}

// Workflow management
export async function getWorkflows(): Promise<Workflow[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/workflows`);
    if (!response.ok) throw new Error('Failed to fetch workflows');
    return response.json();
  } catch {
    return [];
  }
}

export async function createWorkflow(workflow: Omit<Workflow, 'id'>): Promise<Workflow> {
  const response = await fetch(`${API_BASE_URL}/api/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });

  if (!response.ok) throw new Error('Failed to create workflow');
  return response.json();
}

export async function updateWorkflowStatus(
  id: string, 
  status: Workflow['status']
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/workflows/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) throw new Error('Failed to update workflow status');
}

export async function deleteWorkflow(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/workflows/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete workflow');
}

// System status
export async function getSystemStatus(): Promise<SystemStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/status`);
    if (!response.ok) throw new Error('Failed to fetch status');
    const data = await response.json();
    return { connected: true, ...data };
  } catch {
    return { connected: false };
  }
}

// ============ WEB AUDIT ============

export interface AuditResult {
  url: string;
  timestamp: string;
  score: number;
  ssl: {
    valid: boolean;
    issuer?: string;
    expiresAt?: string;
  };
  headers: {
    name: string;
    present: boolean;
    value?: string;
  }[];
  vulnerabilities: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
  }[];
  seo: {
    score: number;
    issues: string[];
  };
}

export async function scanWebsite(
  url: string, 
  mode: 'quick' | 'full' = 'quick'
): Promise<AuditResult> {
  const response = await fetch(`${API_BASE_URL}/api/audit/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, mode }),
  });

  if (!response.ok) throw new Error('Audit scan failed');
  return response.json();
}

export async function exportAuditReport(auditResult: AuditResult): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/audit/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auditResult),
  });

  if (!response.ok) throw new Error('Export failed');
  return response.blob();
}

// ============ FILE GENERATOR ============

export type FileType = 'pdf' | 'docx' | 'xlsx' | 'pptx';

export interface GeneratedFile {
  id: string;
  name: string;
  type: FileType;
  size: number;
  createdAt: string;
  url?: string;
}

export async function generateFile(
  type: FileType,
  content: string,
  useAI: boolean = false
): Promise<GeneratedFile> {
  const response = await fetch(`${API_BASE_URL}/api/files/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, content, useAI }),
  });

  if (!response.ok) throw new Error('File generation failed');
  return response.json();
}

export async function downloadFile(fileId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/download`);
  if (!response.ok) throw new Error('Download failed');
  return response.blob();
}

export async function getGeneratedFiles(): Promise<GeneratedFile[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/files`);
    if (!response.ok) throw new Error('Failed to fetch files');
    return response.json();
  } catch {
    return [];
  }
}

// ============ PROGRAMS ============

export interface Program {
  id: string;
  name: string;
  icon: string;
  command: string;
  category?: 'system' | 'alfa-studio' | 'custom';
}

export interface ProgramHistory {
  id: string;
  program: string;
  command: string;
  executedAt: string;
  success: boolean;
}

export async function getAvailablePrograms(): Promise<Program[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/programs/list`);
    if (!response.ok) throw new Error('Failed to fetch programs');
    return response.json();
  } catch {
    return [
      // System programs
      { id: 'vscode', name: 'VS Code', icon: 'code', command: 'code', category: 'system' },
      { id: 'chrome', name: 'Chrome', icon: 'chrome', command: 'chrome', category: 'system' },
      { id: 'word', name: 'Word', icon: 'file-text', command: 'winword', category: 'system' },
      { id: 'excel', name: 'Excel', icon: 'table', command: 'excel', category: 'system' },
      { id: 'powershell', name: 'PowerShell', icon: 'terminal', command: 'powershell', category: 'system' },
      // ALFA Studio scripts
      { id: 'alfa-gui', name: 'ALFA Studio GUI', icon: 'wand-2', command: 'python alpha_studio_ui.py', category: 'alfa-studio' },
      { id: 'alfa-generator', name: 'Image Generator', icon: 'image', command: 'python ai_generator.py', category: 'alfa-studio' },
      { id: 'alfa-clothes', name: 'Wirtualna Przymierzalnia', icon: 'shirt', command: 'python ai_clothes.py', category: 'alfa-studio' },
      { id: 'alfa-text', name: 'Polski Tekst', icon: 'type', command: 'python ai_text_pl.py', category: 'alfa-studio' },
      { id: 'alfa-upscale', name: 'AI Upscaler', icon: 'maximize-2', command: 'python ai_upscale.py', category: 'alfa-studio' },
    ];
  }
}

export async function openProgram(command: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/programs/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });

  if (!response.ok) throw new Error('Failed to open program');
  return response.json();
}

export async function getProgramHistory(): Promise<ProgramHistory[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/programs/history`);
    if (!response.ok) throw new Error('Failed to fetch history');
    return response.json();
  } catch {
    return [];
  }
}

// ============ IMAGE GENERATION (ALFA STUDIO) ============

export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  model: string;
  resolution: string;
  guidanceScale?: number;
  steps?: number;
  seed?: number;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  resolution: string;
  createdAt: string;
}

export async function generateImage(params: ImageGenerationParams): Promise<GeneratedImage> {
  const response = await fetch(`${API_BASE_URL}/api/image/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) throw new Error('Image generation failed');
  
  const data = await response.json();
  return {
    id: data.id || crypto.randomUUID(),
    url: data.url || data.image_url,
    prompt: params.prompt,
    model: params.model,
    resolution: params.resolution,
    createdAt: new Date().toISOString(),
  };
}

export async function upscaleImage(imageUrl: string, scale: number = 4): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/image/upscale`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl, scale }),
  });

  if (!response.ok) throw new Error('Upscaling failed');
  const data = await response.json();
  return data.url;
}
