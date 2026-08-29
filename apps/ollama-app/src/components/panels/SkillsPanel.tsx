import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Puzzle, 
  Search,
  Download,
  ExternalLink,
  Package,
  Wrench,
  Sparkles,
  RefreshCw,
  Plus,
  Code,
  Globe,
  FileText,
  Mail,
  Calendar,
  Database,
  Shield,
  Loader2,
} from 'lucide-react';
import { getSkills, enableSkill, disableSkill, installSkill, type Skill } from '@/lib/gateway';
import { toast } from 'sonner';

interface SkillsPanelProps {
  isConnected: boolean;
}

const SKILL_ICONS: Record<string, React.ElementType> = {
  'web-search': Globe,
  'code-exec': Code,
  'file-ops': FileText,
  'calendar': Calendar,
  'email': Mail,
  'database': Database,
  'security': Shield,
};

const SOURCE_BADGES = {
  bundled: { label: 'Wbudowany', variant: 'default' as const },
  managed: { label: 'Zarządzany', variant: 'secondary' as const },
  workspace: { label: 'Workspace', variant: 'outline' as const },
};

// ClawdHub - Skills Registry (wzorowane na Moltbot)
const FEATURED_SKILLS = [
  {
    id: 'browser-automation',
    name: 'Browser Automation',
    description: 'Automatyzacja przeglądarki z CDP - kliknięcia, nawigacja, screenshots',
    version: '2.0.0',
    tools: ['browser_navigate', 'browser_click', 'browser_screenshot', 'browser_eval'],
    author: 'ALFA Team',
    downloads: 1250,
  },
  {
    id: 'notion-integration',
    name: 'Notion Integration',
    description: 'Pełna integracja z Notion - strony, bazy danych, komentarze',
    version: '1.5.0',
    tools: ['notion_search', 'notion_create', 'notion_update'],
    author: 'Community',
    downloads: 890,
  },
  {
    id: 'image-gen',
    name: 'Image Generation',
    description: 'Generowanie obrazów z SDXL, DALL-E, Midjourney',
    version: '1.2.0',
    tools: ['image_generate', 'image_edit', 'image_upscale'],
    author: 'ALFA Team',
    downloads: 2100,
  },
  {
    id: 'voice-assistant',
    name: 'Voice Assistant',
    description: 'STT i TTS - Whisper, Kokoro, ElevenLabs',
    version: '1.0.0',
    tools: ['voice_transcribe', 'voice_synthesize', 'voice_clone'],
    author: 'ALFA Team',
    downloads: 750,
  },
  {
    id: 'github-integration',
    name: 'GitHub Integration',
    description: 'Issues, PRs, Actions - pełna integracja z GitHub',
    version: '1.3.0',
    tools: ['github_issues', 'github_pr', 'github_actions'],
    author: 'Community',
    downloads: 1800,
  },
];

export function SkillsPanel({ isConnected }: SkillsPanelProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const data = await getSkills();
      setSkills(data);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSkill = async (skillId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enableSkill(skillId);
      } else {
        await disableSkill(skillId);
      }
      setSkills(prev => prev.map(s => 
        s.id === skillId ? { ...s, enabled } : s
      ));
      toast.success(enabled ? 'Skill włączony' : 'Skill wyłączony');
    } catch (error) {
      toast.error('Nie udało się zmienić statusu skill');
    }
  };

  const handleInstall = async () => {
    if (!installUrl.trim()) return;
    
    setInstalling(true);
    try {
      const skill = await installSkill(installUrl);
      setSkills(prev => [...prev, skill]);
      setInstallUrl('');
      toast.success(`Skill "${skill.name}" zainstalowany!`);
    } catch (error) {
      toast.error('Nie udało się zainstalować skill');
    } finally {
      setInstalling(false);
    }
  };

  const handleInstallFeatured = async (skillId: string) => {
    const featured = FEATURED_SKILLS.find(s => s.id === skillId);
    if (!featured) return;

    // Simulate installation
    toast.success(`Instaluję "${featured.name}"...`);
    
    setTimeout(() => {
      const newSkill: Skill = {
        id: featured.id,
        name: featured.name,
        description: featured.description,
        version: featured.version,
        enabled: true,
        source: 'managed',
        tools: featured.tools,
        author: featured.author,
      };
      setSkills(prev => [...prev, newSkill]);
      toast.success(`Skill "${featured.name}" zainstalowany!`);
    }, 1500);
  };

  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const bundledSkills = filteredSkills.filter(s => s.source === 'bundled');
  const managedSkills = filteredSkills.filter(s => s.source === 'managed');
  const workspaceSkills = filteredSkills.filter(s => s.source === 'workspace');

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Skills List */}
      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Puzzle className="h-5 w-5" />
                Skills Registry
              </CardTitle>
              <CardDescription>
                Zarządzaj umiejętnościami AI - wzorowane na ClawdHub
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadSkills}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Szukaj skills..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="installed">
              <TabsList className="mb-4">
                <TabsTrigger value="installed">
                  Zainstalowane ({skills.length})
                </TabsTrigger>
                <TabsTrigger value="featured">
                  Polecane
                </TabsTrigger>
              </TabsList>

              <TabsContent value="installed">
                <ScrollArea className="h-[400px]">
                  {skills.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Brak zainstalowanych skills</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredSkills.map((skill) => {
                        const Icon = SKILL_ICONS[skill.id] || Wrench;
                        const sourceBadge = SOURCE_BADGES[skill.source];
                        
                        return (
                          <div
                            key={skill.id}
                            className="flex items-center justify-between p-4 rounded-lg border"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-muted">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{skill.name}</span>
                                  <Badge variant={sourceBadge.variant} className="text-xs">
                                    {sourceBadge.label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    v{skill.version}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {skill.description}
                                </p>
                                <div className="flex gap-1 mt-1">
                                  {skill.tools.slice(0, 3).map(tool => (
                                    <Badge key={tool} variant="outline" className="text-xs">
                                      {tool}
                                    </Badge>
                                  ))}
                                  {skill.tools.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{skill.tools.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Switch
                              checked={skill.enabled}
                              onCheckedChange={(checked) => handleToggleSkill(skill.id, checked)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="featured">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {FEATURED_SKILLS.map((skill) => {
                      const isInstalled = skills.some(s => s.id === skill.id);
                      
                      return (
                        <div
                          key={skill.id}
                          className="flex items-center justify-between p-4 rounded-lg border"
                        >
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                              <Sparkles className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{skill.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  v{skill.version}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {skill.description}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <span>by {skill.author}</span>
                                <span>·</span>
                                <Download className="h-3 w-3" />
                                <span>{skill.downloads}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant={isInstalled ? 'outline' : 'default'}
                            size="sm"
                            disabled={isInstalled}
                            onClick={() => handleInstallFeatured(skill.id)}
                          >
                            {isInstalled ? 'Zainstalowany' : 'Zainstaluj'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Install & Stats */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Zainstaluj skill
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="URL do SKILL.md lub repozytorium..."
                value={installUrl}
                onChange={(e) => setInstallUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Podaj URL do pliku SKILL.md lub repozytorium GitHub
              </p>
            </div>
            <Button 
              className="w-full" 
              onClick={handleInstall}
              disabled={!installUrl.trim() || installing}
            >
              {installing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {installing ? 'Instalowanie...' : 'Zainstaluj'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statystyki</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zainstalowane</span>
              <span className="font-medium">{skills.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aktywne</span>
              <span className="font-medium text-green-500">
                {skills.filter(s => s.enabled).length}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Wbudowane</span>
              <span>{bundledSkills.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zarządzane</span>
              <span>{managedSkills.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Workspace</span>
              <span>{workspaceSkills.length}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dostępne narzędzia</span>
              <span className="font-medium">
                {skills.filter(s => s.enabled).reduce((sum, s) => sum + s.tools.length, 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
