import { useState, useEffect } from 'react';
import { Terminal, Play, Code, Chrome, FileText, Table, Clock, Loader2, CheckCircle, XCircle, Wand2, Image, Shirt, Type, Maximize2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAvailablePrograms, openProgram, getProgramHistory, type Program, type ProgramHistory } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface ProgramsPanelProps {
  isConnected: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  'code': Code,
  'chrome': Chrome,
  'file-text': FileText,
  'table': Table,
  'terminal': Terminal,
  'wand-2': Wand2,
  'image': Image,
  'shirt': Shirt,
  'type': Type,
  'maximize-2': Maximize2,
};

export function ProgramsPanel({ isConnected }: ProgramsPanelProps) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [history, setHistory] = useState<ProgramHistory[]>([]);
  const [customCommand, setCustomCommand] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [runningProgram, setRunningProgram] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [fetchedPrograms, fetchedHistory] = await Promise.all([
      getAvailablePrograms(),
      getProgramHistory(),
    ]);
    setPrograms(fetchedPrograms);
    setHistory(fetchedHistory);
    setIsLoading(false);
  };

  const handleOpenProgram = async (command: string, programName?: string) => {
    if (!command.trim()) {
      toast({ title: 'Błąd', description: 'Wprowadź komendę', variant: 'destructive' });
      return;
    }

    setRunningProgram(command);
    try {
      const result = await openProgram(command);
      if (result.success) {
        toast({ 
          title: 'Sukces', 
          description: programName ? `Uruchomiono ${programName}` : 'Komenda wykonana' 
        });
        // Refresh history
        const newHistory = await getProgramHistory();
        setHistory(newHistory);
      } else {
        toast({ title: 'Błąd', description: result.message, variant: 'destructive' });
      }
    } catch (error) {
      toast({ 
        title: 'Błąd', 
        description: 'Nie udało się wykonać komendy. Sprawdź połączenie z ALFA CORE.', 
        variant: 'destructive' 
      });
    } finally {
      setRunningProgram(null);
      setCustomCommand('');
    }
  };

  const getIcon = (iconName: string) => {
    const Icon = iconMap[iconName] || Terminal;
    return <Icon className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Zarządzanie Programami
          </CardTitle>
          <CardDescription>
            Szybki dostęp do aplikacji i wykonywanie poleceń
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ALFA Studio Section */}
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              ALFA Studio
              <Badge variant="secondary" className="text-xs">Python AI</Badge>
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {programs.filter(p => p.category === 'alfa-studio').map((program) => (
                  <Button
                    key={program.id}
                    variant="outline"
                    className="h-auto py-4 flex-col gap-2 border-primary/20 hover:border-primary/50 hover:bg-primary/5"
                    disabled={!isConnected || runningProgram !== null}
                    onClick={() => handleOpenProgram(program.command, program.name)}
                  >
                    {runningProgram === program.command ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      getIcon(program.icon)
                    )}
                    <span className="text-xs">{program.name}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* System Programs Section */}
          <div>
            <h3 className="text-sm font-medium mb-3">Aplikacje Systemowe</h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {programs.filter(p => p.category !== 'alfa-studio').map((program) => (
                  <Button
                    key={program.id}
                    variant="outline"
                    className="h-auto py-4 flex-col gap-2"
                    disabled={!isConnected || runningProgram !== null}
                    onClick={() => handleOpenProgram(program.command, program.name)}
                  >
                    {runningProgram === program.command ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      getIcon(program.icon)
                    )}
                    <span className="text-xs">{program.name}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Command */}
          <div>
            <h3 className="text-sm font-medium mb-3">Własna Komenda</h3>
            <div className="flex gap-2">
              <Input
                placeholder="np. notepad, calc, cmd /c dir"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                disabled={!isConnected || runningProgram !== null}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleOpenProgram(customCommand);
                  }
                }}
              />
              <Button 
                onClick={() => handleOpenProgram(customCommand)}
                disabled={!isConnected || !customCommand.trim() || runningProgram !== null}
              >
                {runningProgram === customCommand ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Wprowadź komendę PowerShell/Bash do wykonania na lokalnym systemie
            </p>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Historia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Brak historii uruchomień
            </p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 10).map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {item.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                    <div>
                      <p className="font-mono text-sm">{item.command}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.executedAt).toLocaleString('pl-PL')}
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleOpenProgram(item.command)}
                    disabled={!isConnected || runningProgram !== null}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!isConnected && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Brak połączenia z ALFA CORE. Uruchom backend na localhost:8000
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
