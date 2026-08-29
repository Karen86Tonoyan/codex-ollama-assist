// Agent Auto-Executor v2
// Ollama raportuje → Cerber kontroluje → Użytkownik zatwierdza → Agent wykonuje
// Każdy krok wymaga zatwierdzenia (TAK/NIE) przed wykonaniem

import { execCommand, execBriefcasePipeline, type ExecResult } from './briefcase';

export interface AgentAction {
  id: string;
  type: 'command' | 'briefcase' | 'file_write' | 'plan';
  command?: string;
  action?: string;
  platform?: string;
  filePath?: string;
  fileContent?: string;
  description: string;
  explanation: string; // wyjaśnienie co robi i dlaczego
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'done' | 'error' | 'skipped';
  cerberVerdict?: CerberVerdict;
}

export interface CerberVerdict {
  safe: boolean;
  reason: string;
  riskScore: number; // 0-1
}

export interface AgentStepResult {
  action: AgentAction;
  result?: ExecResult;
  success: boolean;
  output: string;
  timestamp: Date;
}

export interface AgentPlan {
  id: string;
  actions: AgentAction[];
  currentStep: number;
  status: 'awaiting_approval' | 'in_progress' | 'completed' | 'aborted';
  results: AgentStepResult[];
  createdAt: Date;
}

// ── Risk Assessment ─────────────────────────────────────────

const HIGH_RISK_PATTERNS = [
  /rm\s+-rf/i, /del\s+\/s/i, /format\s+/i, /shutdown/i,
  /mkfs/i, /dd\s+if=/i, /regedit/i, /reg\s+delete/i,
];

const MEDIUM_RISK_PATTERNS = [
  /pip\s+install/i, /npm\s+install/i, /briefcase\s+build/i,
  /briefcase\s+package/i, /git\s+push/i, /git\s+reset/i,
];

const CRITICAL_PATTERNS = [
  /rm\s+-rf\s+\//i, /format\s+c:/i, /del\s+\/s\s+\/q\s+c:/i,
  /shutdown\s+\/s/i, /::\(\)\{/i, /fork\s+bomb/i,
];

function assessRisk(command: string): 'low' | 'medium' | 'high' | 'critical' {
  if (CRITICAL_PATTERNS.some(p => p.test(command))) return 'critical';
  if (HIGH_RISK_PATTERNS.some(p => p.test(command))) return 'high';
  if (MEDIUM_RISK_PATTERNS.some(p => p.test(command))) return 'medium';
  return 'low';
}

// ── Cerber Validation ───────────────────────────────────────

function cerberValidate(action: AgentAction): CerberVerdict {
  const cmd = action.command || '';

  // Critical: always block
  if (action.riskLevel === 'critical') {
    return {
      safe: false,
      reason: `🚫 ZABLOKOWANE: Komenda "${cmd}" jest niebezpieczna i nie może być wykonana.`,
      riskScore: 1.0,
    };
  }

  // High risk: warn but allow with user consent
  if (action.riskLevel === 'high') {
    return {
      safe: true,
      reason: `⚠️ RYZYKO: Ta komenda może modyfikować system. Upewnij się, że rozumiesz skutki.`,
      riskScore: 0.7,
    };
  }

  // Medium risk
  if (action.riskLevel === 'medium') {
    return {
      safe: true,
      reason: `ℹ️ Komenda modyfikuje środowisko (instalacja pakietów lub build). Bezpieczna w kontekście rozwoju.`,
      riskScore: 0.4,
    };
  }

  // Low risk
  return {
    safe: true,
    reason: `✅ Bezpieczna komenda - tylko odczyt lub diagnostyka.`,
    riskScore: 0.1,
  };
}

// ── Explanation Generator ───────────────────────────────────

function generateExplanation(action: AgentAction): string {
  const cmd = action.command || '';

  if (/pip\s+install/i.test(cmd)) {
    const pkg = cmd.replace(/pip\s+install\s+/i, '').trim();
    return `Instaluje pakiet Python "${pkg}" w systemie. Potrzebny do działania projektu.`;
  }

  if (/briefcase\s+new/i.test(cmd)) {
    return 'Tworzy nowy projekt Briefcase z domyślną strukturą plików (pyproject.toml, src/, etc).';
  }
  if (/briefcase\s+create/i.test(cmd)) {
    return `Tworzy scaffolding platformowy dla ${action.platform || 'wybranej platformy'}. Generuje pliki konfiguracyjne natywnego buildu.`;
  }
  if (/briefcase\s+build/i.test(cmd)) {
    return `Kompiluje aplikację na platformę ${action.platform || 'docelową'}. Tworzy binarki/pakiet gotowy do uruchomienia.`;
  }
  if (/briefcase\s+run/i.test(cmd)) {
    return 'Uruchamia zbudowaną aplikację w trybie natywnym.';
  }
  if (/briefcase\s+dev/i.test(cmd)) {
    return 'Uruchamia aplikację w trybie deweloperskim (bez budowania natywnego pakietu).';
  }
  if (/briefcase\s+package/i.test(cmd)) {
    return `Pakuje aplikację w dystrybucyjny format (MSI, DMG, AppImage, APK) dla platformy ${action.platform || 'docelowej'}.`;
  }
  if (/briefcase\s+--version/i.test(cmd)) {
    return 'Sprawdza zainstalowaną wersję Briefcase. Tylko odczyt.';
  }

  if (/python\s+--version/i.test(cmd) || /python3?\s+-V/i.test(cmd)) {
    return 'Sprawdza wersję Pythona. Tylko odczyt, bezpieczne.';
  }

  if (/npm\s+install/i.test(cmd)) {
    return 'Instaluje zależności Node.js z package.json.';
  }

  if (/git\s+/i.test(cmd)) {
    return `Operacja Git: ${cmd}. Modyfikuje repozytorium.`;
  }

  if (/dir|ls|cat|type|echo|whoami|pwd/i.test(cmd)) {
    return 'Komenda diagnostyczna - wyświetla informacje. Tylko odczyt, w pełni bezpieczna.';
  }

  return `Wykonuje komendę: \`${cmd}\``;
}

// ── Parse AI Response ───────────────────────────────────────

export function parseAgentActions(aiResponse: string): AgentAction[] {
  const actions: AgentAction[] = [];

  // Pattern 1: ```powershell/bash blocks
  const shellBlockRegex = /```(?:powershell|bash|shell|cmd|terminal|sh)\n([\s\S]*?)```/gi;
  let match;
  while ((match = shellBlockRegex.exec(aiResponse)) !== null) {
    const commands = match[1].trim().split('\n').filter(l => l.trim() && !l.startsWith('#'));
    for (const cmd of commands) {
      const action: AgentAction = {
        id: crypto.randomUUID(),
        type: 'command',
        command: cmd.trim(),
        description: `Wykonaj: ${cmd.trim()}`,
        explanation: '',
        riskLevel: 'low',
        status: 'pending',
      };
      action.riskLevel = assessRisk(cmd);
      action.explanation = generateExplanation(action);
      action.cerberVerdict = cerberValidate(action);
      actions.push(action);
    }
  }

  // Pattern 2: $ or > prefixed lines
  const lineRegex = /^[\$>]\s+(.+)$/gm;
  while ((match = lineRegex.exec(aiResponse)) !== null) {
    const cmd = match[1].trim();
    if (!actions.some(a => a.command === cmd)) {
      const action: AgentAction = {
        id: crypto.randomUUID(),
        type: 'command',
        command: cmd,
        description: `Wykonaj: ${cmd}`,
        explanation: '',
        riskLevel: 'low',
        status: 'pending',
      };
      action.riskLevel = assessRisk(cmd);
      action.explanation = generateExplanation(action);
      action.cerberVerdict = cerberValidate(action);
      actions.push(action);
    }
  }

  // Pattern 3: Briefcase-specific
  const briefcaseRegex = /briefcase\s+(new|create|build|run|dev|update|package|install)\s*([\w\s-]*)/gi;
  while ((match = briefcaseRegex.exec(aiResponse)) !== null) {
    const act = match[1].toLowerCase();
    const platform = match[2]?.trim() || 'windows';
    const fullCmd = `briefcase ${act} ${platform}`.trim();
    if (!actions.some(a => a.command?.includes(fullCmd))) {
      const action: AgentAction = {
        id: crypto.randomUUID(),
        type: 'briefcase',
        action: act,
        platform,
        command: fullCmd,
        description: `Briefcase ${act} (${platform})`,
        explanation: '',
        riskLevel: 'low',
        status: 'pending',
      };
      action.riskLevel = assessRisk(fullCmd);
      action.explanation = generateExplanation(action);
      action.cerberVerdict = cerberValidate(action);
      actions.push(action);
    }
  }

  // Pattern 4: pip install
  const pipRegex = /pip\s+install\s+[\w\s\->=.]+/gi;
  while ((match = pipRegex.exec(aiResponse)) !== null) {
    const cmd = match[0].trim();
    if (!actions.some(a => a.command === cmd)) {
      const action: AgentAction = {
        id: crypto.randomUUID(),
        type: 'command',
        command: cmd,
        description: `Instalacja: ${cmd}`,
        explanation: '',
        riskLevel: 'medium',
        status: 'pending',
      };
      action.explanation = generateExplanation(action);
      action.cerberVerdict = cerberValidate(action);
      actions.push(action);
    }
  }

  return actions;
}

// ── Execute Single Action ───────────────────────────────────

export async function executeSingleAction(action: AgentAction): Promise<AgentStepResult> {
  let result: ExecResult | undefined;
  let success = false;
  let output = '';

  try {
    if (action.type === 'briefcase' && action.action) {
      const bResult = await execBriefcasePipeline(
        action.action as 'install' | 'new' | 'create' | 'build' | 'run' | 'dev' | 'update' | 'package',
        { platform: action.platform }
      );
      result = bResult;
      success = bResult.success;
      output = bResult.stdout || bResult.stderr || '';
    } else if (action.command) {
      result = await execCommand(action.command);
      success = result.success;
      output = result.stdout || result.stderr || '';
    }
  } catch (e) {
    output = `❌ Błąd: ${e instanceof Error ? e.message : 'Połączenie z backendem nie powiodło się'}`;
    success = false;
  }

  return {
    action,
    result,
    success,
    output: output.slice(0, 3000),
    timestamp: new Date(),
  };
}

// ── Create Plan ─────────────────────────────────────────────

export function createAgentPlan(actions: AgentAction[]): AgentPlan {
  return {
    id: crypto.randomUUID(),
    actions,
    currentStep: 0,
    status: 'awaiting_approval',
    results: [],
    createdAt: new Date(),
  };
}

// ── Format Plan for Display ─────────────────────────────────

export function formatPlanMessage(plan: AgentPlan): string {
  let msg = `🤖 **Agent zaplanował ${plan.actions.length} krok(ów)**\n\nKażdy krok wymaga Twojego zatwierdzenia. Cerber ocenił ryzyko.\n\n---\n\n`;

  for (let i = 0; i < plan.actions.length; i++) {
    const a = plan.actions[i];
    const riskIcon = a.riskLevel === 'critical' ? '🔴' : a.riskLevel === 'high' ? '🟠' : a.riskLevel === 'medium' ? '🟡' : '🟢';
    const cerberIcon = a.cerberVerdict?.safe ? '✅' : '🚫';

    msg += `### Krok ${i + 1}: ${a.description}\n`;
    msg += `${riskIcon} **Ryzyko:** ${a.riskLevel.toUpperCase()}\n`;
    msg += `${cerberIcon} **Cerber:** ${a.cerberVerdict?.reason || 'Brak oceny'}\n`;
    msg += `📋 **Co robi:** ${a.explanation}\n`;
    msg += `\`\`\`\n${a.command || a.description}\n\`\`\`\n\n`;
  }

  msg += `---\n⏳ **Oczekuję na Twoje zatwierdzenie każdego kroku poniżej.**`;

  return msg;
}

// ── Format Step Result ──────────────────────────────────────

export function formatStepResult(stepResult: AgentStepResult): string {
  const icon = stepResult.success ? '✅' : '❌';
  const duration = stepResult.result?.duration_ms ? ` (${stepResult.result.duration_ms}ms)` : '';

  let msg = `${icon} **${stepResult.action.description}**${duration}\n`;

  if (stepResult.output.trim()) {
    const trimmed = stepResult.output.trim().slice(0, 500);
    msg += `\`\`\`\n${trimmed}\n\`\`\`\n`;
  }

  return msg;
}

// ── Format Final Report ─────────────────────────────────────

export function formatAgentReport(results: AgentStepResult[]): string {
  if (results.length === 0) return '';

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  let report = `\n---\n🤖 **Raport Agenta** — ${successCount}/${totalCount} kroków zakończonych sukcesem\n\n`;

  for (const r of results) {
    report += formatStepResult(r);
    report += '\n';
  }

  return report;
}

// ── Check for executable content ────────────────────────────

export function hasExecutableContent(text: string): boolean {
  const patterns = [
    /```(?:powershell|bash|shell|cmd|terminal|sh)\n/i,
    /^[\$>]\s+/m,
    /briefcase\s+(new|create|build|run|dev|update|package)/i,
    /pip\s+install\s+/i,
    /npm\s+(install|run|start)/i,
    /python\s+\w+\.py/i,
  ];
  return patterns.some(p => p.test(text));
}

// ── Risk Level Helpers ──────────────────────────────────────

export function getRiskColor(risk: AgentAction['riskLevel']): string {
  switch (risk) {
    case 'critical': return 'text-red-600 bg-red-500/10 border-red-500/30';
    case 'high': return 'text-orange-600 bg-orange-500/10 border-orange-500/30';
    case 'medium': return 'text-yellow-600 bg-yellow-500/10 border-yellow-500/30';
    case 'low': return 'text-green-600 bg-green-500/10 border-green-500/30';
  }
}

export function getRiskLabel(risk: AgentAction['riskLevel']): string {
  switch (risk) {
    case 'critical': return 'KRYTYCZNE';
    case 'high': return 'WYSOKIE';
    case 'medium': return 'ŚREDNIE';
    case 'low': return 'NISKIE';
  }
}
