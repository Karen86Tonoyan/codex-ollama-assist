import { 
  Mic, MessageSquare, Bot, PenTool, Globe, Wand2, ShieldCheck, ShieldAlert, UserCog, BookOpen, GitBranch,
  FileText, Zap, Puzzle, Server, Laptop, Clock, MessageCircle, Shield, Terminal, Hammer, Wrench, Code, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export type TabType = 
  | 'voice' | 'chat' | 'ollama' | 'canvas' | 'browser' | 'image' | 'audiobook' 
  | 'agents' | 'cerber' | 'guardian' | 'admin'
  | 'files' | 'workflow' | 'plugins' | 'mcp' | 'nodes' | 'cron' | 'channels' 
  | 'security' | 'programs' | 'appbuilder' | 'sessions' | 'skills' | 'n8n' 
  | 'ollama-auto' | 'webaudit' | 'camera' | 'openhands' | 'codeserver' | 'susichat'
  | 'langchain' | 'ui-tars';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'chat', label: 'Chat AI', icon: MessageSquare },
  { id: 'susichat', label: 'SUSI/llama.cpp', icon: Terminal },
  { id: 'ollama', label: 'Ollama/Qwen', icon: Bot },
  { id: 'canvas', label: 'Canvas', icon: PenTool },
  { id: 'browser', label: 'Browser', icon: Globe },
  { id: 'image', label: 'Obrazy', icon: Wand2 },
  { id: 'audiobook', label: 'AudioBook', icon: BookOpen },
  { id: 'files', label: 'Pliki', icon: FileText },
  { id: 'programs', label: 'Programy', icon: Terminal },
  { id: 'appbuilder', label: 'App Builder', icon: Hammer },
  { id: 'plugins', label: 'Wtyczki', icon: Puzzle },
  { id: 'mcp', label: 'MCP', icon: Server },
  { id: 'workflow', label: 'Workflow', icon: Zap },
  { id: 'n8n', label: 'n8n', icon: Zap },
  { id: 'langchain', label: 'LangChain', icon: GitBranch },
  { id: 'agents', label: 'Agenci', icon: GitBranch },
  { id: 'openhands', label: 'OpenHands', icon: Bot },
  { id: 'ui-tars', label: 'UI-TARS', icon: Eye },
  { id: 'codeserver', label: 'VS Code', icon: Code },
  { id: 'nodes', label: 'Urządzenia', icon: Laptop },
  { id: 'channels', label: 'Kanały', icon: MessageCircle },
  { id: 'sessions', label: 'Sesje', icon: MessageSquare },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'cron', label: 'Cron/Webhook', icon: Clock },
  { id: 'camera', label: 'Kamera', icon: Globe },
  { id: 'webaudit', label: 'Web Audit', icon: Shield },
  { id: 'security', label: 'Bezpieczeństwo', icon: ShieldCheck },
  { id: 'cerber', label: 'Cerber', icon: ShieldCheck },
  { id: 'guardian', label: 'Guardian', icon: ShieldAlert },
  { id: 'admin', label: 'Admin', icon: UserCog },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="px-6 py-4">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <Button
                key={tab.id}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  "gap-2 flex-shrink-0",
                  isActive && "shadow-md"
                )}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </nav>
  );
}
