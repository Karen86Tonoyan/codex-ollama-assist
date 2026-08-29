/**
 * Gateway WebSocket Control Plane
 * Wzorowane na Moltbot - centralne sterowanie sesjami, kanałami i narzędziami
 */

const GATEWAY_URL = 'ws://127.0.0.1:8765/ws';

// ============= TYPES =============

export type ChannelType = 
  | 'whatsapp' 
  | 'telegram' 
  | 'discord' 
  | 'slack' 
  | 'signal' 
  | 'imessage'
  | 'teams'
  | 'matrix'
  | 'webchat';

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'pairing';
  lastActivity?: Date;
  config?: Record<string, unknown>;
  allowFrom?: string[];
}

export interface Session {
  id: string;
  channelId: string;
  peerId: string;
  peerName?: string;
  status: 'active' | 'idle' | 'closed';
  mode: 'ANALITYK' | 'UZDROWICIEL' | 'TOWARZYSZ';
  createdAt: Date;
  lastMessage?: Date;
  messageCount: number;
  tokenUsage?: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  source: 'bundled' | 'managed' | 'workspace';
  tools: string[];
  author?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;  // cron expression
  action: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'error';
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled: boolean;
  lastTriggered?: Date;
}

export interface DeviceNode {
  id: string;
  name: string;
  type: 'macos' | 'ios' | 'android' | 'windows' | 'linux';
  status: 'online' | 'offline' | 'pairing';
  capabilities: string[];
  lastSeen?: Date;
  ip?: string;
}

export interface GatewayMessage {
  type: string;
  payload: unknown;
  requestId?: string;
}

// ============= GATEWAY CLIENT =============

type MessageHandler = (message: GatewayMessage) => void;

class GatewayClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private connectionPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    
    if (this.connectionPromise) return this.connectionPromise;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(GATEWAY_URL);

        this.ws.onopen = () => {
          console.log('[Gateway] Connected');
          this.reconnectAttempts = 0;
          this.connectionPromise = null;
          this.emit('connected', {});
          resolve();
        };

        this.ws.onclose = () => {
          console.log('[Gateway] Disconnected');
          this.connectionPromise = null;
          this.emit('disconnected', {});
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[Gateway] Error:', error);
          this.connectionPromise = null;
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onmessage = (event) => {
          try {
            const message: GatewayMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error('[Gateway] Failed to parse message:', e);
          }
        };
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[Gateway] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[Gateway] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  private handleMessage(message: GatewayMessage): void {
    // Check for pending request response
    if (message.requestId && this.pendingRequests.has(message.requestId)) {
      const pending = this.pendingRequests.get(message.requestId)!;
      this.pendingRequests.delete(message.requestId);
      
      if (message.type === 'error') {
        pending.reject(new Error(message.payload as string));
      } else {
        pending.resolve(message.payload);
      }
      return;
    }

    // Emit to handlers
    this.emit(message.type, message.payload);
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      }
    };
  }

  private emit(type: string, payload: unknown): void {
    const handlers = this.handlers.get(type) || [];
    const message: GatewayMessage = { type, payload };
    handlers.forEach(handler => handler(message));

    // Also emit to wildcard handlers
    const wildcardHandlers = this.handlers.get('*') || [];
    wildcardHandlers.forEach(handler => handler(message));
  }

  async send<T = unknown>(type: string, payload: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      
      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000);

      const message: GatewayMessage = { type, payload, requestId };
      this.ws!.send(JSON.stringify(message));
    });
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const gateway = new GatewayClient();

// ============= CHANNEL OPERATIONS =============

export async function getChannels(): Promise<Channel[]> {
  try {
    return await gateway.send<Channel[]>('channels.list', {});
  } catch {
    // Fallback to demo data
    return [
      { id: '1', type: 'telegram', name: 'Telegram Bot', status: 'connected', lastActivity: new Date() },
      { id: '2', type: 'discord', name: 'Discord Server', status: 'connected', lastActivity: new Date() },
      { id: '3', type: 'whatsapp', name: 'WhatsApp Business', status: 'pairing' },
      { id: '4', type: 'slack', name: 'Slack Workspace', status: 'disconnected' },
      { id: '5', type: 'webchat', name: 'WebChat', status: 'connected', lastActivity: new Date() },
    ];
  }
}

export async function connectChannel(type: ChannelType, config: Record<string, unknown>): Promise<Channel> {
  return gateway.send<Channel>('channels.connect', { type, config });
}

export async function disconnectChannel(channelId: string): Promise<void> {
  return gateway.send<void>('channels.disconnect', { channelId });
}

export async function getChannelQR(channelId: string): Promise<string> {
  return gateway.send<string>('channels.qr', { channelId });
}

// ============= SESSION OPERATIONS =============

export async function getSessions(): Promise<Session[]> {
  try {
    return await gateway.send<Session[]>('sessions.list', {});
  } catch {
    // Fallback to demo data
    return [
      { 
        id: '1', 
        channelId: '1', 
        peerId: 'user123', 
        peerName: 'Jan Kowalski',
        status: 'active', 
        mode: 'TOWARZYSZ',
        createdAt: new Date(Date.now() - 3600000),
        lastMessage: new Date(),
        messageCount: 42,
        tokenUsage: 15420,
      },
      { 
        id: '2', 
        channelId: '2', 
        peerId: 'discord_user_456',
        peerName: 'AlphaUser#1234',
        status: 'idle', 
        mode: 'ANALITYK',
        createdAt: new Date(Date.now() - 86400000),
        lastMessage: new Date(Date.now() - 7200000),
        messageCount: 128,
        tokenUsage: 45600,
      },
    ];
  }
}

export async function getSessionHistory(sessionId: string): Promise<{ role: string; content: string; timestamp: Date }[]> {
  return gateway.send('sessions.history', { sessionId });
}

export async function sendToSession(sessionId: string, message: string): Promise<void> {
  return gateway.send('sessions.send', { sessionId, message });
}

export async function closeSession(sessionId: string): Promise<void> {
  return gateway.send('sessions.close', { sessionId });
}

export async function setSessionMode(sessionId: string, mode: Session['mode']): Promise<void> {
  return gateway.send('sessions.setMode', { sessionId, mode });
}

// ============= SKILLS OPERATIONS =============

export async function getSkills(): Promise<Skill[]> {
  try {
    return await gateway.send<Skill[]>('skills.list', {});
  } catch {
    // Fallback to demo data
    return [
      {
        id: 'web-search',
        name: 'Web Search',
        description: 'Wyszukiwanie w internecie z DuckDuckGo',
        version: '1.0.0',
        enabled: true,
        source: 'bundled',
        tools: ['web_search', 'web_scrape'],
      },
      {
        id: 'code-exec',
        name: 'Code Execution',
        description: 'Wykonywanie kodu Python w sandbox',
        version: '1.2.0',
        enabled: true,
        source: 'bundled',
        tools: ['python_exec', 'bash_exec'],
      },
      {
        id: 'file-ops',
        name: 'File Operations',
        description: 'Operacje na plikach - read, write, edit',
        version: '1.0.0',
        enabled: true,
        source: 'bundled',
        tools: ['file_read', 'file_write', 'file_edit', 'file_delete'],
      },
      {
        id: 'calendar',
        name: 'Calendar Integration',
        description: 'Integracja z Google Calendar',
        version: '0.9.0',
        enabled: false,
        source: 'managed',
        tools: ['calendar_list', 'calendar_create', 'calendar_update'],
        author: 'ALFA Team',
      },
      {
        id: 'email',
        name: 'Email',
        description: 'Wysyłanie i odbieranie emaili przez Gmail',
        version: '1.1.0',
        enabled: false,
        source: 'managed',
        tools: ['email_send', 'email_read', 'email_search'],
        author: 'ALFA Team',
      },
    ];
  }
}

export async function enableSkill(skillId: string): Promise<void> {
  return gateway.send('skills.enable', { skillId });
}

export async function disableSkill(skillId: string): Promise<void> {
  return gateway.send('skills.disable', { skillId });
}

export async function installSkill(url: string): Promise<Skill> {
  return gateway.send('skills.install', { url });
}

// ============= CRON OPERATIONS =============

export async function getCronJobs(): Promise<CronJob[]> {
  try {
    return await gateway.send<CronJob[]>('cron.list', {});
  } catch {
    return [
      {
        id: '1',
        name: 'Daily Summary',
        schedule: '0 9 * * *',
        action: 'send_daily_summary',
        enabled: true,
        lastRun: new Date(Date.now() - 86400000),
        nextRun: new Date(Date.now() + 43200000),
        status: 'idle',
      },
      {
        id: '2',
        name: 'Weekly Backup',
        schedule: '0 0 * * 0',
        action: 'backup_memories',
        enabled: true,
        lastRun: new Date(Date.now() - 604800000),
        nextRun: new Date(Date.now() + 259200000),
        status: 'idle',
      },
    ];
  }
}

export async function createCronJob(job: Omit<CronJob, 'id' | 'status' | 'lastRun' | 'nextRun'>): Promise<CronJob> {
  return gateway.send('cron.create', job);
}

export async function updateCronJob(jobId: string, updates: Partial<CronJob>): Promise<CronJob> {
  return gateway.send('cron.update', { jobId, ...updates });
}

export async function deleteCronJob(jobId: string): Promise<void> {
  return gateway.send('cron.delete', { jobId });
}

export async function runCronJob(jobId: string): Promise<void> {
  return gateway.send('cron.run', { jobId });
}

// ============= WEBHOOK OPERATIONS =============

export async function getWebhooks(): Promise<Webhook[]> {
  try {
    return await gateway.send<Webhook[]>('webhooks.list', {});
  } catch {
    return [
      {
        id: '1',
        name: 'GitHub Events',
        url: '/webhooks/github',
        events: ['push', 'pull_request', 'issues'],
        enabled: true,
        lastTriggered: new Date(Date.now() - 3600000),
      },
      {
        id: '2',
        name: 'Stripe Payments',
        url: '/webhooks/stripe',
        secret: 'whsec_***',
        events: ['payment_intent.succeeded', 'payment_intent.failed'],
        enabled: true,
      },
    ];
  }
}

export async function createWebhook(webhook: Omit<Webhook, 'id' | 'lastTriggered'>): Promise<Webhook> {
  return gateway.send('webhooks.create', webhook);
}

export async function deleteWebhook(webhookId: string): Promise<void> {
  return gateway.send('webhooks.delete', { webhookId });
}

// ============= NODE OPERATIONS =============

export async function getNodes(): Promise<DeviceNode[]> {
  try {
    return await gateway.send<DeviceNode[]>('nodes.list', {});
  } catch {
    return [
      {
        id: '1',
        name: 'MacBook Pro',
        type: 'macos',
        status: 'online',
        capabilities: ['system.run', 'system.notify', 'camera', 'screen.record'],
        lastSeen: new Date(),
        ip: '192.168.1.100',
      },
      {
        id: '2',
        name: 'iPhone 15 Pro',
        type: 'ios',
        status: 'online',
        capabilities: ['camera', 'location', 'notifications', 'canvas'],
        lastSeen: new Date(),
      },
      {
        id: '3',
        name: 'Windows Desktop',
        type: 'windows',
        status: 'offline',
        capabilities: ['system.run', 'camera', 'screen.record'],
        lastSeen: new Date(Date.now() - 86400000),
        ip: '192.168.1.50',
      },
    ];
  }
}

export async function invokeNode(nodeId: string, action: string, params?: Record<string, unknown>): Promise<unknown> {
  return gateway.send('nodes.invoke', { nodeId, action, params });
}

export async function pairNode(): Promise<{ code: string; expiresAt: Date }> {
  return gateway.send('nodes.pair', {});
}
