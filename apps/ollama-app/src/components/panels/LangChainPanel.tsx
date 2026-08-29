import { useState, useCallback } from 'react';
import {
  Link2, Plus, Trash2, Play, RotateCcw, Settings2, Loader2, Copy,
  FileText, Bot, Zap, ArrowRight, ChevronDown, ChevronUp, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ── Types ──

interface ChainStep {
  id: string;
  type: 'llm' | 'prompt' | 'tool' | 'retriever' | 'parser' | 'memory';
  name: string;
  config: Record<string, string>;
}

interface Chain {
  id: string;
  name: string;
  description: string;
  steps: ChainStep[];
  status: 'draft' | 'ready' | 'running' | 'error';
  lastRun?: string;
  lastOutput?: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
}

// ── Step type definitions ──

const STEP_TYPES: { value: ChainStep['type']; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'prompt', label: 'Prompt Template', icon: FileText, description: 'Szablon promptu z zmiennymi' },
  { value: 'llm', label: 'LLM Call', icon: Bot, description: 'Wywołanie modelu językowego' },
  { value: 'tool', label: 'Tool / Function', icon: Zap, description: 'Narzędzie lub funkcja zewnętrzna' },
  { value: 'retriever', label: 'Retriever', icon: Link2, description: 'Wyszukiwanie w bazie wiedzy (RAG)' },
  { value: 'parser', label: 'Output Parser', icon: Settings2, description: 'Parsowanie wyjścia (JSON, lista, etc.)' },
  { value: 'memory', label: 'Memory', icon: RotateCcw, description: 'Pamięć konwersacji' },
];

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'qa',
    name: 'Q&A z kontekstem',
    template: 'Na podstawie poniższego kontekstu odpowiedz na pytanie.\n\nKontekst:\n{context}\n\nPytanie: {question}\n\nOdpowiedź:',
    variables: ['context', 'question'],
  },
  {
    id: 'summarize',
    name: 'Streszczenie',
    template: 'Streść poniższy tekst w maksymalnie {max_words} słowach:\n\n{text}\n\nStreszczenie:',
    variables: ['text', 'max_words'],
  },
  {
    id: 'translate',
    name: 'Tłumaczenie',
    template: 'Przetłumacz poniższy tekst na język {target_lang}:\n\n{text}\n\nTłumaczenie:',
    variables: ['text', 'target_lang'],
  },
  {
    id: 'agent',
    name: 'Agent ReAct',
    template: 'Odpowiedz na pytanie użytkownika, korzystając z dostępnych narzędzi.\n\nNarzędzia: {tools}\n\nPytanie: {input}\n\nMyśl krok po kroku, potem działaj.',
    variables: ['tools', 'input'],
  },
];

// ── Main Component ──

export function LangChainPanel() {
  const [chains, setChains] = useState<Chain[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showNewChain, setShowNewChain] = useState(false);

  // New chain form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  // New step form  
  const [showAddStep, setShowAddStep] = useState(false);
  const [stepType, setStepType] = useState<ChainStep['type']>('prompt');
  const [stepName, setStepName] = useState('');

  // Template form
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplContent, setTplContent] = useState('');

  // Run output
  const [runOutput, setRunOutput] = useState('');
  const [runInput, setRunInput] = useState('');

  const activeChain = chains.find(c => c.id === selectedChain);

  // ── Handlers ──

  const handleCreateChain = useCallback(() => {
    if (!newName.trim()) { toast.error('Podaj nazwę łańcucha'); return; }
    const chain: Chain = {
      id: crypto.randomUUID(),
      name: newName,
      description: newDesc,
      steps: [],
      status: 'draft',
    };
    setChains(prev => [...prev, chain]);
    setSelectedChain(chain.id);
    setNewName('');
    setNewDesc('');
    setShowNewChain(false);
    toast.success(`Łańcuch "${chain.name}" utworzony`);
  }, [newName, newDesc]);

  const handleDeleteChain = useCallback((id: string) => {
    setChains(prev => prev.filter(c => c.id !== id));
    if (selectedChain === id) setSelectedChain(null);
    toast.info('Łańcuch usunięty');
  }, [selectedChain]);

  const handleAddStep = useCallback(() => {
    if (!activeChain || !stepName.trim()) return;
    const step: ChainStep = {
      id: crypto.randomUUID(),
      type: stepType,
      name: stepName,
      config: {},
    };
    setChains(prev => prev.map(c =>
      c.id === activeChain.id
        ? { ...c, steps: [...c.steps, step], status: 'draft' as const }
        : c
    ));
    setStepName('');
    setShowAddStep(false);
    toast.success(`Krok "${step.name}" dodany`);
  }, [activeChain, stepType, stepName]);

  const handleRemoveStep = useCallback((chainId: string, stepId: string) => {
    setChains(prev => prev.map(c =>
      c.id === chainId
        ? { ...c, steps: c.steps.filter(s => s.id !== stepId) }
        : c
    ));
  }, []);

  const handleRunChain = useCallback(async () => {
    if (!activeChain || activeChain.steps.length === 0) {
      toast.error('Dodaj kroki do łańcucha');
      return;
    }
    setIsRunning(true);
    setRunOutput('');
    setChains(prev => prev.map(c => c.id === activeChain.id ? { ...c, status: 'running' as const } : c));

    try {
      // Simulate chain execution (in real impl would call backend)
      await new Promise(r => setTimeout(r, 1500));
      
      const steps = activeChain.steps.map(s => s.name).join(' → ');
      const output = `✅ Łańcuch "${activeChain.name}" wykonany pomyślnie.\n\nKroki: ${steps}\nInput: ${runInput || '(brak)'}\n\n--- Wynik ---\nŁańcuch przetworzył dane przez ${activeChain.steps.length} kroków.\nStatus: COMPLETED`;

      setRunOutput(output);
      setChains(prev => prev.map(c =>
        c.id === activeChain.id
          ? { ...c, status: 'ready' as const, lastRun: new Date().toISOString(), lastOutput: output }
          : c
      ));
      toast.success('Łańcuch wykonany!');
    } catch (err) {
      setChains(prev => prev.map(c => c.id === activeChain.id ? { ...c, status: 'error' as const } : c));
      toast.error('Błąd wykonania łańcucha');
    } finally {
      setIsRunning(false);
    }
  }, [activeChain, runInput]);

  const handleCreateTemplate = useCallback(() => {
    if (!tplName.trim() || !tplContent.trim()) { toast.error('Wypełnij pola'); return; }
    const vars = [...tplContent.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    const tpl: PromptTemplate = {
      id: crypto.randomUUID(),
      name: tplName,
      template: tplContent,
      variables: vars,
    };
    setTemplates(prev => [...prev, tpl]);
    setTplName('');
    setTplContent('');
    setShowNewTemplate(false);
    toast.success(`Szablon "${tpl.name}" utworzony`);
  }, [tplName, tplContent]);

  const handleCopyTemplate = useCallback((tpl: PromptTemplate) => {
    navigator.clipboard.writeText(tpl.template);
    toast.success('Skopiowano do schowka');
  }, []);

  // ── Status badge helper ──
  const statusBadge = (status: Chain['status']) => {
    const map = {
      draft: { label: 'Szkic', variant: 'outline' as const },
      ready: { label: 'Gotowy', variant: 'default' as const },
      running: { label: 'Działa...', variant: 'secondary' as const },
      error: { label: 'Błąd', variant: 'destructive' as const },
    };
    const { label, variant } = map[status];
    return <Badge variant={variant}>{label}</Badge>;
  };

  // ── Render ──

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">LangChain Studio</h2>
          <Badge variant="outline" className="text-xs">v0.3</Badge>
        </div>
      </div>

      <Tabs defaultValue="chains" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chains" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Łańcuchy
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Szablony Promptów
          </TabsTrigger>
          <TabsTrigger value="docs" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Dokumentacja
          </TabsTrigger>
        </TabsList>

        {/* ═══ CHAINS TAB ═══ */}
        <TabsContent value="chains" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Chain list */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Moje Łańcuchy</CardTitle>
                  <Dialog open={showNewChain} onOpenChange={setShowNewChain}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Nowy</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Nowy Łańcuch</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Nazwa</Label>
                          <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="np. RAG Pipeline" className="h-8 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Opis</Label>
                          <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Co robi ten łańcuch..." className="text-xs min-h-[60px]" />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button size="sm" onClick={handleCreateChain} disabled={!newName.trim()}>
                          <Plus className="h-3.5 w-3.5 mr-1" />Utwórz
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {chains.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-xs">
                      <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Brak łańcuchów</p>
                      <p className="mt-1">Kliknij "Nowy" aby utworzyć pierwszy łańcuch</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chains.map(chain => (
                        <div
                          key={chain.id}
                          className={cn(
                            "p-3 rounded-lg cursor-pointer border transition-colors",
                            selectedChain === chain.id
                              ? "border-primary bg-primary/5"
                              : "border-transparent hover:bg-muted/50"
                          )}
                          onClick={() => setSelectedChain(chain.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{chain.name}</span>
                            {statusBadge(chain.status)}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 truncate">{chain.description || 'Brak opisu'}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-[10px]">{chain.steps.length} kroków</Badge>
                            <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto" onClick={e => { e.stopPropagation(); handleDeleteChain(chain.id); }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chain detail / builder */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  {activeChain ? `🔗 ${activeChain.name}` : 'Edytor Łańcucha'}
                </CardTitle>
                {activeChain && <CardDescription className="text-xs">{activeChain.description}</CardDescription>}
              </CardHeader>
              <CardContent>
                {!activeChain ? (
                  <div className="text-center py-16 text-muted-foreground text-sm">
                    <Bot className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Wybierz łańcuch z listy lub utwórz nowy</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Steps visualization */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Kroki łańcucha</Label>
                        <Dialog open={showAddStep} onOpenChange={setShowAddStep}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Dodaj krok</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Nowy krok</DialogTitle></DialogHeader>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs">Typ</Label>
                                <Select value={stepType} onValueChange={v => setStepType(v as ChainStep['type'])}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {STEP_TYPES.map(st => (
                                      <SelectItem key={st.value} value={st.value}>
                                        <span className="flex items-center gap-2">
                                          <st.icon className="h-3.5 w-3.5" />
                                          {st.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-[10px] text-muted-foreground">
                                  {STEP_TYPES.find(s => s.value === stepType)?.description}
                                </p>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">Nazwa kroku</Label>
                                <Input value={stepName} onChange={e => setStepName(e.target.value)} placeholder="np. Embed Query" className="h-8 text-sm" />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button size="sm" onClick={handleAddStep} disabled={!stepName.trim()}>
                                <Plus className="h-3.5 w-3.5 mr-1" />Dodaj
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>

                      {activeChain.steps.length === 0 ? (
                        <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground text-xs">
                          Brak kroków — dodaj pierwszy krok aby zbudować łańcuch
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {activeChain.steps.map((step, idx) => {
                            const StepIcon = STEP_TYPES.find(s => s.value === step.type)?.icon || Zap;
                            return (
                              <div key={step.id}>
                                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border">
                                  <Badge variant="secondary" className="text-[10px] w-5 h-5 flex items-center justify-center p-0 shrink-0">
                                    {idx + 1}
                                  </Badge>
                                  <StepIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs font-medium">{step.name}</span>
                                    <span className="text-[10px] text-muted-foreground ml-2">({STEP_TYPES.find(s => s.value === step.type)?.label})</span>
                                  </div>
                                  <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => handleRemoveStep(activeChain.id, step.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                {idx < activeChain.steps.length - 1 && (
                                  <div className="flex justify-center py-0.5">
                                    <ArrowRight className="h-3 w-3 text-muted-foreground rotate-90" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Run section */}
                    <Card className="bg-muted/30">
                      <CardContent className="pt-4 space-y-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Input (opcjonalny)</Label>
                          <Textarea
                            value={runInput}
                            onChange={e => setRunInput(e.target.value)}
                            placeholder="Wpisz dane wejściowe dla łańcucha..."
                            className="text-xs min-h-[50px] resize-none"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleRunChain}
                          disabled={isRunning || activeChain.steps.length === 0}
                          className="w-full"
                        >
                          {isRunning ? (
                            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Wykonuję...</>
                          ) : (
                            <><Play className="h-3.5 w-3.5 mr-1" />Uruchom łańcuch</>
                          )}
                        </Button>
                        {runOutput && (
                          <pre className="text-[10px] bg-background p-3 rounded-md border overflow-auto max-h-[200px] whitespace-pre-wrap font-mono">
                            {runOutput}
                          </pre>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ TEMPLATES TAB ═══ */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Szablony promptów do użycia w łańcuchach i agentach</p>
            <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Nowy szablon</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nowy szablon promptu</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nazwa</Label>
                    <Input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="np. Email Writer" className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Szablon (użyj {'{zmienna}'} dla zmiennych)</Label>
                    <Textarea
                      value={tplContent}
                      onChange={e => setTplContent(e.target.value)}
                      placeholder="Napisz {typ} email do {odbiorca} na temat {temat}..."
                      className="text-xs min-h-[120px]"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button size="sm" onClick={handleCreateTemplate} disabled={!tplName.trim() || !tplContent.trim()}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Utwórz
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map(tpl => (
              <Card key={tpl.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{tpl.name}</CardTitle>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleCopyTemplate(tpl)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <pre className="text-[10px] bg-muted p-2 rounded-md overflow-auto max-h-[100px] whitespace-pre-wrap font-mono">
                    {tpl.template}
                  </pre>
                  <div className="flex flex-wrap gap-1">
                    {tpl.variables.map(v => (
                      <Badge key={v} variant="secondary" className="text-[10px]">{`{${v}}`}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ═══ DOCS TAB ═══ */}
        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                LangChain — Szybki start
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-muted-foreground">
              <div>
                <h4 className="font-semibold text-foreground mb-1">Co to jest LangChain?</h4>
                <p>LangChain to framework do budowania aplikacji opartych na modelach językowych (LLM). Pozwala tworzyć łańcuchy przetwarzania, agentów i systemy RAG.</p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Koncepty</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Chain</strong> — sekwencja kroków przetwarzania danych</li>
                  <li><strong>Prompt Template</strong> — szablon promptu z zmiennymi</li>
                  <li><strong>LLM</strong> — wywołanie modelu językowego</li>
                  <li><strong>Retriever</strong> — wyszukiwanie kontekstu (RAG)</li>
                  <li><strong>Tool</strong> — narzędzie zewnętrzne (API, funkcja, etc.)</li>
                  <li><strong>Memory</strong> — pamięć konwersacji między wywołaniami</li>
                  <li><strong>Output Parser</strong> — parsowanie odpowiedzi do struktury</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Przykładowy łańcuch RAG</h4>
                <pre className="bg-muted p-3 rounded-md font-mono text-[10px] overflow-auto">
{`1. Retriever  → Wyszukaj dokumenty pasujące do pytania
2. Prompt     → Wstaw dokumenty + pytanie do szablonu
3. LLM        → Wyślij prompt do modelu
4. Parser     → Wyciągnij odpowiedź w formacie JSON`}
                </pre>
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Linki</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li><a href="https://docs.langchain.com" target="_blank" rel="noopener" className="text-primary hover:underline">docs.langchain.com</a></li>
                  <li><a href="https://github.com/langchain-ai/langchain" target="_blank" rel="noopener" className="text-primary hover:underline">GitHub — langchain-ai/langchain</a></li>
                  <li><a href="https://python.langchain.com/docs/how_to/" target="_blank" rel="noopener" className="text-primary hover:underline">How-to Guides</a></li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
