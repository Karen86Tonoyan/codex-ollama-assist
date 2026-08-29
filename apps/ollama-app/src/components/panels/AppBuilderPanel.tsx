import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Hammer, Play, Download, Trash2, Plus, Loader2, Code2, 
  Monitor, Smartphone, Apple, Terminal, FileCode, Package,
  Wand2, Eye, FolderOpen, Zap, CheckCircle2, XCircle,
  GitBranch, RefreshCw, ExternalLink, Rocket
} from 'lucide-react';
import { useOllama } from '@/hooks/useOllama';
import { 
  generateAppCode, parseGeneratedFiles, 
  type BriefcaseProject, type ProjectFile, type BuildResult, type BriefcaseAction,
  checkBriefcase, createProject, buildProject, runProject, exportProject, deleteProject,
  updateProjectFiles, execCommand, execBriefcasePipeline, type ExecResult
} from '@/lib/briefcase';
import {
  fetchRepoCommits, fetchRepoInfo, fetchRepoTemplates, cloneTemplate, BRIEFCASE_TEMPLATES,
  type GitHubCommit, type GitHubTemplate,
} from '@/lib/github-briefcase';
import { toast } from 'sonner';

interface LocalProject {
  id: string;
  name: string;
  appName: string;
  description: string;
  template: 'toga' | 'console' | 'flask';
  files: ProjectFile[];
  status: 'draft' | 'created' | 'building' | 'built' | 'error';
  buildLogs: string[];
  createdAt: string;
}

export function AppBuilderPanel() {
  const { models, activeModel, isAvailable } = useOllama();

  // State
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [activeProject, setActiveProject] = useState<LocalProject | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [selectedModel, setSelectedModel] = useState(activeModel || '');
  const [selectedTemplate, setSelectedTemplate] = useState<'toga' | 'console' | 'flask'>('toga');
  const [newProjectName, setNewProjectName] = useState('');
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [briefcaseReady, setBriefcaseReady] = useState<boolean | null>(null);
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState<Array<{ cmd: string; result: ExecResult }>>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState<Array<{ action: string; success: boolean; output: string }>>([]);

  // GitHub state
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [templates, setTemplates] = useState<GitHubTemplate[]>([]);
  const [repoInfo, setRepoInfo] = useState<{ stars: number; forks: number; lastPush: string; description: string } | null>(null);
  const [loadingGithub, setLoadingGithub] = useState(false);
  const [cloningTemplate, setCloningTemplate] = useState<string | null>(null);

  // Check Briefcase on mount
  useEffect(() => {
    checkBriefcase().then(s => setBriefcaseReady(s.installed));
  }, []);

  // Generate code with Ollama
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || !selectedModel) return;

    setIsGenerating(true);
    setGeneratedCode('');

    try {
      const code = await generateAppCode(
        prompt,
        selectedModel,
        selectedTemplate,
        (chunk) => setGeneratedCode(prev => prev + chunk)
      );

      const files = parseGeneratedFiles(code);

      if (activeProject) {
        const updated = { ...activeProject, files, status: 'draft' as const };
        setActiveProject(updated);
        setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
      }

      toast.success(`Wygenerowano ${files.length} plik(ów)`);
    } catch (error) {
      toast.error('Błąd generowania kodu');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, selectedModel, selectedTemplate, activeProject]);

  // Create new project
  const handleNewProject = useCallback(() => {
    const name = newProjectName.trim() || `projekt-${Date.now()}`;
    const project: LocalProject = {
      id: crypto.randomUUID(),
      name,
      appName: name.replace(/[^a-zA-Z0-9]/g, ''),
      description: '',
      template: selectedTemplate,
      files: [],
      status: 'draft',
      buildLogs: [],
      createdAt: new Date().toISOString(),
    };
    setProjects(prev => [...prev, project]);
    setActiveProject(project);
    setNewProjectName('');
    toast.success(`Projekt "${name}" utworzony`);
  }, [newProjectName, selectedTemplate]);

  // Build project
  const handleBuild = useCallback(async (platform: string) => {
    if (!activeProject) return;
    setIsBuilding(true);
    setBuildLogs([]);

    try {
      // First update files on backend
      await updateProjectFiles(activeProject.id, activeProject.files);

      const result = await buildProject(
        activeProject.id,
        platform,
        (log) => setBuildLogs(prev => [...prev, log])
      );

      const updated = {
        ...activeProject,
        status: result.success ? 'built' as const : 'error' as const,
        buildLogs: [...buildLogs, ...(result.logs || [])],
      };
      setActiveProject(updated);
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));

      if (result.success) {
        toast.success(`Build ${platform} zakończony!`);
      } else {
        toast.error(`Build failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Build failed');
    } finally {
      setIsBuilding(false);
    }
  }, [activeProject, buildLogs]);

  // Run project
  const handleRun = useCallback(async () => {
    if (!activeProject) return;
    try {
      const result = await runProject(activeProject.id);
      toast.success(result.message || 'Uruchomiono');
    } catch {
      toast.error('Nie udało się uruchomić');
    }
  }, [activeProject]);

  // Export ZIP
  const handleExport = useCallback(async () => {
    if (!activeProject) return;
    try {
      const blob = await exportProject(activeProject.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeProject.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Eksportowano');
    } catch {
      // Fallback: export files as text
      const content = activeProject.files.map(f => `# ${f.path}\n${f.content}`).join('\n\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeProject.name}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [activeProject]);

  // Delete project
  const handleDelete = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProject?.id === id) setActiveProject(null);
    deleteProject(id).catch(() => {});
    toast.success('Usunięto');
  }, [activeProject]);

  // Update file content inline
  const handleFileEdit = useCallback((index: number, content: string) => {
    if (!activeProject) return;
    const files = [...activeProject.files];
    files[index] = { ...files[index], content };
    const updated = { ...activeProject, files };
    setActiveProject(updated);
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, [activeProject]);

  // Execute shell command
  const handleExec = useCallback(async () => {
    if (!terminalInput.trim()) return;
    setIsExecuting(true);
    try {
      const result = await execCommand(terminalInput);
      setTerminalHistory(prev => [...prev, { cmd: terminalInput, result }]);
      setTerminalInput('');
      if (!result.success) {
        toast.error(`Komenda zakończona z kodem ${result.exit_code}`);
      }
    } catch {
      toast.error('Nie można wykonać komendy – backend niedostępny');
    } finally {
      setIsExecuting(false);
    }
  }, [terminalInput]);

  // Auto-pipeline: install → create → build → update → package
  const handleAutoPipeline = useCallback(async (platform: string, mode: 'build' | 'full' | 'dev' = 'build') => {
    if (!activeProject) return;
    setPipelineRunning(true);
    setPipelineLogs([]);

    let steps: Array<{ action: BriefcaseAction; label: string }>;

    if (mode === 'dev') {
      steps = [
        { action: 'install', label: 'Instalacja Briefcase' },
        { action: 'create', label: `Tworzenie projektu (${platform})` },
        { action: 'dev', label: `Dev mode (${platform})` },
      ];
    } else if (mode === 'full') {
      steps = [
        { action: 'install', label: 'Instalacja Briefcase' },
        { action: 'create', label: `Tworzenie projektu (${platform})` },
        { action: 'build', label: `Budowanie na ${platform}` },
        { action: 'update', label: `Aktualizacja (${platform})` },
        { action: 'package', label: `Pakowanie dystrybucji (${platform})` },
      ];
    } else {
      steps = [
        { action: 'install', label: 'Instalacja Briefcase' },
        { action: 'create', label: `Tworzenie projektu (${platform})` },
        { action: 'build', label: `Budowanie na ${platform}` },
      ];
    }

    for (const step of steps) {
      setPipelineLogs(prev => [...prev, { action: step.label, success: true, output: '⏳ Wykonuję...' }]);
      try {
        const result = await execBriefcasePipeline(step.action, {
          platform,
          project_dir: undefined,
        });
        setPipelineLogs(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            action: step.label,
            success: result.success,
            output: result.stdout || result.stderr || (result.success ? '✅ OK' : '❌ Błąd'),
          };
          return updated;
        });
        if (!result.success) {
          toast.error(`Pipeline zatrzymany: ${step.label}`);
          break;
        }
      } catch (e) {
        setPipelineLogs(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            action: step.label,
            success: false,
            output: `❌ ${e instanceof Error ? e.message : 'Błąd połączenia'}`,
          };
          return updated;
        });
        toast.error('Pipeline przerwany – backend niedostępny');
        break;
      }
    }

    setPipelineRunning(false);
    toast.success('Pipeline zakończony');
  }, [activeProject]);

  // Fetch GitHub data
  const handleLoadGithub = useCallback(async () => {
    setLoadingGithub(true);
    try {
      const [commitData, info, tpl] = await Promise.all([
        fetchRepoCommits(15),
        fetchRepoInfo(),
        fetchRepoTemplates(),
      ]);
      setCommits(commitData);
      setRepoInfo(info);
      setTemplates(tpl);
      if (commitData.length > 0) toast.success(`Załadowano ${commitData.length} commitów`);
      else toast.info('Brak danych z GitHub');
    } catch {
      toast.error('Nie udało się pobrać danych z GitHub');
    } finally {
      setLoadingGithub(false);
    }
  }, []);

  // Clone template from GitHub into a new project
  const handleCloneTemplate = useCallback(async (tplPath: string, tplName: string) => {
    setCloningTemplate(tplPath);
    try {
      const result = await cloneTemplate({ name: tplName, path: tplPath, type: 'dir', download_url: null });
      if (result.files.length === 0) {
        toast.error('Nie znaleziono plików do sklonowania');
        return;
      }

      const project: LocalProject = {
        id: crypto.randomUUID(),
        name: `clone-${tplName}`,
        appName: tplName.replace(/[^a-zA-Z0-9]/g, ''),
        description: `Sklonowano z GitHub: ${tplPath}`,
        template: 'toga',
        files: result.files,
        status: 'draft',
        buildLogs: [],
        createdAt: new Date().toISOString(),
      };

      setProjects(prev => [...prev, project]);
      setActiveProject(project);
      setActiveFileIndex(0);
      toast.success(`Sklonowano ${result.files.length} plików z "${tplName}"`);
    } catch {
      toast.error('Błąd klonowania szablonu');
    } finally {
      setCloningTemplate(null);
    }
  }, []);

  const templateOptions = [
    { value: 'toga', label: 'Toga GUI', icon: Monitor },
    { value: 'console', label: 'Console', icon: Terminal },
    { value: 'flask', label: 'Flask API', icon: Package },
  ];

  const platformOptions = [
    { value: 'macOS', label: 'macOS', icon: Apple },
    { value: 'windows', label: 'Windows', icon: Monitor },
    { value: 'linux', label: 'Linux', icon: Terminal },
    { value: 'iOS', label: 'iOS', icon: Smartphone },
    { value: 'android', label: 'Android', icon: Smartphone },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Hammer className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-bold">App Builder</h2>
            <p className="text-sm text-muted-foreground">
              Ollama generuje kod → Briefcase buduje natywne apki
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={isAvailable ? 'default' : 'destructive'}>
            Ollama: {isAvailable ? 'ON' : 'OFF'}
          </Badge>
          <Badge variant={briefcaseReady ? 'default' : 'secondary'}>
            Briefcase: {briefcaseReady ? 'OK' : briefcaseReady === null ? '...' : 'N/A'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sidebar: Projects */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Projekty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nazwa projektu..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                className="text-sm"
              />
              <Button size="sm" onClick={handleNewProject}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className={`p-2 rounded-md border cursor-pointer transition-colors ${
                      activeProject?.id === p.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => { setActiveProject(p); setActiveFileIndex(0); }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">{p.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">{p.template}</Badge>
                      <Badge 
                        variant={p.status === 'built' ? 'default' : p.status === 'error' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {projects.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Brak projektów. Utwórz nowy powyżej.
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Area */}
        <div className="lg:col-span-3 space-y-4">
          {/* AI Generator */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                Generator AI
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Model Ollama..." />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v as 'toga' | 'console' | 'flask')}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !prompt.trim() || !selectedModel || !activeProject}
                  className="gap-2"
                >
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
                  {isGenerating ? 'Generuję...' : 'Generuj kod'}
                </Button>
              </div>

              <Textarea
                placeholder="Opisz aplikację, którą chcesz zbudować... np. 'Stwórz kalkulator z GUI w Toga z historią obliczeń'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="text-sm"
              />
            </CardContent>
          </Card>

          {/* Code Editor / Preview / Build */}
          {activeProject && (
            <Card>
              <Tabs defaultValue="code">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <TabsList>
                      <TabsTrigger value="code" className="gap-1">
                        <FileCode className="h-3 w-3" />
                        Kod
                      </TabsTrigger>
                      <TabsTrigger value="preview" className="gap-1">
                        <Eye className="h-3 w-3" />
                        Podgląd
                      </TabsTrigger>
                      <TabsTrigger value="build" className="gap-1">
                        <Hammer className="h-3 w-3" />
                        Build
                      </TabsTrigger>
                      <TabsTrigger value="terminal" className="gap-1">
                        <Terminal className="h-3 w-3" />
                        Terminal
                      </TabsTrigger>
                      <TabsTrigger value="pipeline" className="gap-1">
                        <Zap className="h-3 w-3" />
                        Pipeline
                      </TabsTrigger>
                      <TabsTrigger value="github" className="gap-1">
                        <GitBranch className="h-3 w-3" />
                        GitHub
                      </TabsTrigger>
                    </TabsList>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleRun} className="gap-1">
                        <Play className="h-3 w-3" />
                        Run
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleExport} className="gap-1">
                        <Download className="h-3 w-3" />
                        Export
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4">
                  {/* Code Tab */}
                  <TabsContent value="code" className="mt-0">
                    {activeProject.files.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex gap-1 overflow-x-auto pb-2">
                          {activeProject.files.map((f, i) => (
                            <Button
                              key={f.path}
                              variant={activeFileIndex === i ? 'default' : 'outline'}
                              size="sm"
                              className="text-xs flex-shrink-0"
                              onClick={() => setActiveFileIndex(i)}
                            >
                              {f.path}
                            </Button>
                          ))}
                        </div>
                        <Textarea
                          value={activeProject.files[activeFileIndex]?.content || ''}
                          onChange={(e) => handleFileEdit(activeFileIndex, e.target.value)}
                          rows={20}
                          className="font-mono text-xs bg-muted/30"
                        />
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Code2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Użyj generatora AI aby stworzyć kod dla tego projektu</p>
                      </div>
                    )}

                    {/* Streaming preview */}
                    {isGenerating && generatedCode && (
                      <div className="mt-4 p-3 rounded-md bg-muted/20 border">
                        <p className="text-xs font-medium mb-2">Generowanie w toku...</p>
                        <pre className="text-xs font-mono whitespace-pre-wrap max-h-[200px] overflow-auto">
                          {generatedCode}
                        </pre>
                      </div>
                    )}
                  </TabsContent>

                  {/* Preview Tab */}
                  <TabsContent value="preview" className="mt-0">
                    <div className="border rounded-md bg-muted/10 min-h-[400px] flex items-center justify-center">
                      {activeProject.files.length > 0 ? (
                        <ScrollArea className="h-[400px] w-full p-4">
                          <pre className="text-xs font-mono whitespace-pre-wrap">
                            {activeProject.files.map(f => 
                              `# ━━━ ${f.path} ━━━\n${f.content}`
                            ).join('\n\n')}
                          </pre>
                        </ScrollArea>
                      ) : (
                        <p className="text-muted-foreground text-sm">Brak plików do podglądu</p>
                      )}
                    </div>
                  </TabsContent>

                  {/* Build Tab */}
                  <TabsContent value="build" className="mt-0 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {platformOptions.map((p) => {
                        const Icon = p.icon;
                        return (
                          <Button
                            key={p.value}
                            variant="outline"
                            className="gap-2 h-auto py-3 flex-col"
                            disabled={isBuilding || activeProject.files.length === 0}
                            onClick={() => handleBuild(p.value)}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-xs">{p.label}</span>
                          </Button>
                        );
                      })}
                    </div>

                    {isBuilding && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Budowanie...
                      </div>
                    )}

                    {buildLogs.length > 0 && (
                      <ScrollArea className="h-[200px] rounded-md border bg-muted/10 p-3">
                        <pre className="text-xs font-mono whitespace-pre-wrap">
                          {buildLogs.join('')}
                        </pre>
                      </ScrollArea>
                    )}

                    {!briefcaseReady && (
                      <div className="text-xs text-muted-foreground bg-muted/20 rounded-md p-3">
                        <p className="font-medium">⚠️ Briefcase nie wykryty</p>
                        <p className="mt-1">
                          Zainstaluj: <code className="bg-muted px-1 rounded">pip install briefcase</code> 
                          i uruchom backend ALFA z obsługą Briefcase API.
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Terminal Tab */}
                  <TabsContent value="terminal" className="mt-0 space-y-3">
                    <div className="rounded-md border bg-black/90 text-green-400 p-3 min-h-[350px] flex flex-col">
                      <ScrollArea className="flex-1 max-h-[280px] mb-3">
                        <div className="space-y-2 font-mono text-xs">
                          {terminalHistory.length === 0 && (
                            <p className="text-muted-foreground">
                              PowerShell / Bash – wpisz komendę i naciśnij Enter
                            </p>
                          )}
                          {terminalHistory.map((entry, i) => (
                            <div key={i}>
                              <div className="flex items-center gap-1">
                                <span className="text-blue-400">❯</span>
                                <span className="text-white">{entry.cmd}</span>
                                {entry.result.success ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto flex-shrink-0" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-500 ml-auto flex-shrink-0" />
                                )}
                                <span className="text-muted-foreground text-[10px]">{entry.result.duration_ms}ms</span>
                              </div>
                              {entry.result.stdout && (
                                <pre className="text-green-300 whitespace-pre-wrap ml-4 mt-1">{entry.result.stdout}</pre>
                              )}
                              {entry.result.stderr && (
                                <pre className="text-red-400 whitespace-pre-wrap ml-4 mt-1">{entry.result.stderr}</pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      <div className="flex gap-2 items-center border-t border-green-900/50 pt-2">
                        <span className="text-blue-400 font-mono text-sm">❯</span>
                        <Input
                          value={terminalInput}
                          onChange={(e) => setTerminalInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleExec()}
                          placeholder="briefcase build windows..."
                          className="flex-1 bg-transparent border-none text-green-400 font-mono text-xs placeholder:text-green-900 focus-visible:ring-0"
                          disabled={isExecuting}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleExec}
                          disabled={isExecuting || !terminalInput.trim()}
                          className="text-green-400 hover:text-green-300 h-7"
                        >
                          {isExecuting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['pip install briefcase', 'briefcase --version', 'briefcase new', 'python --version'].map(cmd => (
                        <Button
                          key={cmd}
                          variant="outline"
                          size="sm"
                          className="text-xs font-mono"
                          onClick={() => { setTerminalInput(cmd); }}
                        >
                          {cmd}
                        </Button>
                      ))}
                    </div>
                  </TabsContent>

                  {/* Auto Pipeline Tab */}
                  <TabsContent value="pipeline" className="mt-0 space-y-4">
                    <div className="text-sm text-muted-foreground">
                      <Zap className="h-4 w-4 inline mr-1" />
                      Wybierz tryb pipeline i platformę docelową.
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">Build: install → create → build</Badge>
                      <Badge variant="outline" className="text-xs">Full: + update → package</Badge>
                      <Badge variant="outline" className="text-xs">Dev: install → create → dev (hot reload)</Badge>
                    </div>

                    {/* Build pipeline */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">🔨 Build Pipeline</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {platformOptions.map((p) => {
                          const Icon = p.icon;
                          return (
                            <Button key={p.value} variant="outline" className="gap-2 h-auto py-2 flex-col" disabled={pipelineRunning} onClick={() => handleAutoPipeline(p.value, 'build')}>
                              <Icon className="h-4 w-4" />
                              <span className="text-xs">{p.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Full pipeline */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">📦 Full Pipeline (+ Update & Package)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {platformOptions.map((p) => {
                          const Icon = p.icon;
                          return (
                            <Button key={`full-${p.value}`} variant="outline" className="gap-2 h-auto py-2 flex-col" disabled={pipelineRunning} onClick={() => handleAutoPipeline(p.value, 'full')}>
                              <Rocket className="h-4 w-4" />
                              <span className="text-xs">Full {p.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dev mode */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">⚡ Dev Mode (Hot Reload)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {platformOptions.map((p) => {
                          const Icon = p.icon;
                          return (
                            <Button key={`dev-${p.value}`} variant="outline" className="gap-2 h-auto py-2 flex-col border-dashed" disabled={pipelineRunning} onClick={() => handleAutoPipeline(p.value, 'dev')}>
                              <Play className="h-4 w-4" />
                              <span className="text-xs">Dev {p.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {pipelineRunning && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Pipeline w toku...
                      </div>
                    )}

                    {pipelineLogs.length > 0 && (
                      <div className="space-y-2">
                        {pipelineLogs.map((log, i) => (
                          <div key={i} className={`rounded-md border p-3 text-xs font-mono ${log.success ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              {log.output.startsWith('⏳') ? (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              ) : log.success ? (
                                <CheckCircle2 className="h-3 w-3 text-primary" />
                              ) : (
                                <XCircle className="h-3 w-3 text-destructive" />
                              )}
                              <span className="font-medium">{log.action}</span>
                            </div>
                            <pre className="whitespace-pre-wrap text-muted-foreground max-h-[150px] overflow-auto">
                              {log.output}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* GitHub Tab */}
                  <TabsContent value="github" className="mt-0 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Karen86Tonoyan/briefcase</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={handleLoadGithub} disabled={loadingGithub} className="gap-1">
                        {loadingGithub ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        {loadingGithub ? 'Ładuję...' : 'Odśwież'}
                      </Button>
                    </div>

                    {repoInfo && (
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="secondary">⭐ {repoInfo.stars}</Badge>
                        <Badge variant="secondary">🔱 {repoInfo.forks}</Badge>
                        <Badge variant="outline" className="text-xs">
                          Last push: {new Date(repoInfo.lastPush).toLocaleDateString('pl-PL')}
                        </Badge>
                      </div>
                    )}

                    {/* Clone Templates */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">📥 Klonuj szablon do nowego projektu</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {BRIEFCASE_TEMPLATES.map((tpl) => (
                          <Button
                            key={tpl.path}
                            variant="outline"
                            className="h-auto py-3 px-4 flex flex-col items-start gap-1 text-left"
                            disabled={cloningTemplate === tpl.path}
                            onClick={() => handleCloneTemplate(tpl.path, tpl.name)}
                          >
                            <div className="flex items-center gap-2 w-full">
                              {cloningTemplate === tpl.path ? (
                                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                              ) : (
                                <Download className="h-4 w-4 flex-shrink-0 text-primary" />
                              )}
                              <span className="font-medium text-sm">{tpl.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{tpl.description}</span>
                            <code className="text-[10px] text-muted-foreground/60 font-mono">{tpl.path}</code>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Commits */}
                    {commits.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Ostatnie commity</p>
                        <ScrollArea className="h-[150px]">
                          <div className="space-y-1">
                            {commits.map((c) => (
                              <div key={c.sha} className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 text-xs">
                                <code className="text-primary font-mono flex-shrink-0">{c.sha}</code>
                                <span className="truncate flex-1">{c.message}</span>
                                <span className="text-muted-foreground flex-shrink-0">
                                  {c.date ? new Date(c.date).toLocaleDateString('pl-PL') : ''}
                                </span>
                                <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                                  <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                </a>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {/* Browse & Clone from repo structure */}
                    {templates.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Struktura repo — kliknij folder aby sklonować</p>
                        <ScrollArea className="h-[150px]">
                          <div className="space-y-1">
                            {templates.map((t) => (
                              <div key={t.path} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 text-xs group">
                                {t.type === 'dir' ? (
                                  <FolderOpen className="h-3 w-3 text-primary flex-shrink-0" />
                                ) : (
                                  <FileCode className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                )}
                                <span className="font-mono truncate flex-1">{t.path}</span>
                                {t.type === 'dir' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                    disabled={cloningTemplate === t.path}
                                    onClick={() => handleCloneTemplate(t.path, t.name)}
                                  >
                                    {cloningTemplate === t.path ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Download className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {commits.length === 0 && !loadingGithub && (
                      <div className="text-center py-6 text-muted-foreground">
                        <GitBranch className="h-10 w-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Kliknij "Odśwież" aby pobrać commity i strukturę repo</p>
                      </div>
                    )}
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          )}

          {!activeProject && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Hammer className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Wybierz projekt z listy lub utwórz nowy</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
