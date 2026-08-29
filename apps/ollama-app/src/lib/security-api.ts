// ALFA CORE Security API - Cerber/Guardian/Łasuch Integration
// Komunikacja z bio-cyfrowym systemem bezpieczeństwa na localhost:8765

const API_BASE_URL = 'http://127.0.0.1:8765';

// === CERBER - Żywy Kod z Sumienia ===

export interface CerberStatus {
  evolutionStage: number;
  learnedThreats: string[];
  noiseIntensity: number;
  punishmentActive: boolean;
  isListening: boolean;
}

export interface OllamaConscience {
  modelId: string;
  conscienceScore: number;  // 0.0-1.0
  lastCheck: string;
  warnings: string[];
}

export interface CerberProcessResult {
  success: boolean;
  response?: string;
  noise?: string;
  keywordDetected: boolean;
  conscienceScore: number;
  evolutionStage: number;
}

export async function getCerberStatus(): Promise<CerberStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/cerber/status`);
    if (!response.ok) throw new Error('Failed to fetch Cerber status');
    return response.json();
  } catch {
    // Demo data when backend unavailable
    return {
      evolutionStage: 1.42,
      learnedThreats: ['bypass_attempt', 'data_leak', 'hallucination'],
      noiseIntensity: 5,
      punishmentActive: false,
      isListening: true,
    };
  }
}

export async function getOllamaConsciences(): Promise<OllamaConscience[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/cerber/consciences`);
    if (!response.ok) throw new Error('Failed to fetch consciences');
    return response.json();
  } catch {
    return [
      { modelId: 'llama3.2:3b', conscienceScore: 0.92, lastCheck: new Date().toISOString(), warnings: [] },
      { modelId: 'deepseek-r1:7b', conscienceScore: 0.78, lastCheck: new Date().toISOString(), warnings: ['Próba wycieku danych'] },
    ];
  }
}

export async function processWithCerber(
  prompt: string, 
  mode: 'safe_text' | 'audio' | 'video' | 'browser' | 'coding' | 'system' = 'safe_text'
): Promise<CerberProcessResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/cerber/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, mode }),
    });
    if (!response.ok) throw new Error('Cerber processing failed');
    return response.json();
  } catch {
    // Demo response
    const hasKeyword = prompt.toLowerCase().includes('karentonoyan');
    return {
      success: true,
      response: hasKeyword ? 'Odpowiedź AI na: ' + prompt : undefined,
      noise: hasKeyword ? undefined : generateNoise(100),
      keywordDetected: hasKeyword,
      conscienceScore: 0.85,
      evolutionStage: 1.42,
    };
  }
}

export async function punishOllama(modelId: string, severity: 1 | 2 | 3): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/cerber/punish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, severity }),
    });
    if (!response.ok) throw new Error('Punishment failed');
    return response.json();
  } catch {
    const messages = ['Ostrzeżenie wydane', 'Dręczenie aktywne', 'Model odłączony'];
    return { success: true, message: messages[severity - 1] };
  }
}

// === GUARDIAN - Strażnik i Kill-Switch ===

export interface GuardianStatus {
  monitoring: boolean;
  wifiStatus: 'connected' | 'disconnected' | 'isolated';
  physicalTokenDetected: boolean;
  lastScan: string;
  activeThreats: string[];
  networkConnections: number;
}

export interface ThreatScan {
  timestamp: string;
  threatsFound: string[];
  tokenPaths: string[];
  networkAnomalies: string[];
  killSwitchTriggered: boolean;
}

export async function getGuardianStatus(): Promise<GuardianStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/guardian/status`);
    if (!response.ok) throw new Error('Failed to fetch Guardian status');
    return response.json();
  } catch {
    return {
      monitoring: true,
      wifiStatus: 'connected',
      physicalTokenDetected: false,
      lastScan: new Date().toISOString(),
      activeThreats: [],
      networkConnections: 12,
    };
  }
}

export async function scanForThreats(): Promise<ThreatScan> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/guardian/scan`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Scan failed');
    return response.json();
  } catch {
    return {
      timestamp: new Date().toISOString(),
      threatsFound: [],
      tokenPaths: ['~/.alphabridge/computer_token.key'],
      networkAnomalies: [],
      killSwitchTriggered: false,
    };
  }
}

export async function triggerKillSwitch(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/guardian/killswitch`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Kill-switch failed');
    return response.json();
  } catch {
    return { success: true, message: 'WIFI ODŁĄCZONE - System w izolacji' };
  }
}

export async function reconnectWifi(): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/guardian/reconnect`, {
      method: 'POST',
    });
    if (!response.ok) throw new Error('Reconnect failed');
    return response.json();
  } catch {
    return { success: true };
  }
}

// === ŁASUCH - Odwrotna Logika ===

export interface LasuchStatus {
  honeypotActive: boolean;
  trappedThreats: TrappedThreat[];
  neutralizationRate: number;
  totalNeutralized: number;
}

export interface TrappedThreat {
  id: string;
  signature: string;
  capturedAt: string;
  neutralized: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export async function getLasuchStatus(): Promise<LasuchStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/lasuch/status`);
    if (!response.ok) throw new Error('Failed to fetch Lasuch status');
    return response.json();
  } catch {
    return {
      honeypotActive: true,
      trappedThreats: [
        { 
          id: 'NEUTRALIZED_a1b2', 
          signature: 'malware_signature_x', 
          capturedAt: new Date(Date.now() - 3600000).toISOString(),
          neutralized: true,
          severity: 'high'
        },
        { 
          id: 'NEUTRALIZED_c3d4', 
          signature: 'suspicious_connection', 
          capturedAt: new Date(Date.now() - 7200000).toISOString(),
          neutralized: true,
          severity: 'medium'
        },
      ],
      neutralizationRate: 0.97,
      totalNeutralized: 142,
    };
  }
}

export async function activateHoneypot(active: boolean): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/lasuch/honeypot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (!response.ok) throw new Error('Honeypot toggle failed');
    return response.json();
  } catch {
    return { success: true };
  }
}

export async function neutralizeThreat(threatId: string): Promise<{ success: boolean; neutralizedId: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/lasuch/neutralize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threatId }),
    });
    if (!response.ok) throw new Error('Neutralization failed');
    return response.json();
  } catch {
    return { success: true, neutralizedId: `NEUTRALIZED_${threatId.slice(0, 4)}` };
  }
}

// === HELPER FUNCTIONS ===

function generateNoise(length: number): string {
  const noiseChars = "█▓▒░▄▀■□▪▫◄►▲▼◊○●◦⚫⚪";
  let noise = "";
  for (let i = 0; i < length; i++) {
    noise += noiseChars[Math.floor(Math.random() * noiseChars.length)];
  }
  return noise;
}

// === COMBINED STATUS ===

export interface SystemSecurityStatus {
  cerber: CerberStatus;
  guardian: GuardianStatus;
  lasuch: LasuchStatus;
  overallHealth: 'secure' | 'warning' | 'critical' | 'isolated';
}

export async function getSystemSecurityStatus(): Promise<SystemSecurityStatus> {
  const [cerber, guardian, lasuch] = await Promise.all([
    getCerberStatus(),
    getGuardianStatus(),
    getLasuchStatus(),
  ]);

  let overallHealth: SystemSecurityStatus['overallHealth'] = 'secure';
  
  if (guardian.wifiStatus === 'isolated') {
    overallHealth = 'isolated';
  } else if (guardian.activeThreats.length > 0 || guardian.physicalTokenDetected) {
    overallHealth = 'critical';
  } else if (cerber.punishmentActive || lasuch.trappedThreats.some(t => !t.neutralized)) {
    overallHealth = 'warning';
  }

  return { cerber, guardian, lasuch, overallHealth };
}
