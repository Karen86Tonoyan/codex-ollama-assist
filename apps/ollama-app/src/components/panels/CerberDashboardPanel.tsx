import { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  ShieldAlert,
  Clock,
  Trash2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { cerberHistory, type CerberLogEntry } from '@/lib/cerber-history';
import { cn } from '@/lib/utils';

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'przed chwilą';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins} min temu`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h temu`;
  }
  
  // Full date
  return date.toLocaleString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDecisionIcon(decision: CerberLogEntry['decision']) {
  switch (decision) {
    case 'PASS':
    case 'ALLOW':
      return <ShieldCheck className="h-4 w-4 text-green-500" />;
    case 'BLOCK':
      return <ShieldX className="h-4 w-4 text-red-500" />;
    case 'REQUIRE_CONFIRM':
    case 'MODIFY':
      return <ShieldAlert className="h-4 w-4 text-yellow-500" />;
    default:
      return <Shield className="h-4 w-4" />;
  }
}

function getDecisionBadge(decision: CerberLogEntry['decision']) {
  switch (decision) {
    case 'PASS':
    case 'ALLOW':
      return <Badge variant="outline" className="border-green-500/50 text-green-500">PASS</Badge>;
    case 'BLOCK':
      return <Badge variant="outline" className="border-red-500/50 text-red-500">BLOCK</Badge>;
    case 'REQUIRE_CONFIRM':
      return <Badge variant="outline" className="border-yellow-500/50 text-yellow-500">CONFIRM</Badge>;
    case 'MODIFY':
      return <Badge variant="outline" className="border-orange-500/50 text-orange-500">MODIFY</Badge>;
    default:
      return <Badge variant="outline">UNKNOWN</Badge>;
  }
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color,
  percentage 
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType;
  color: string;
  percentage?: number;
}) {
  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
          </div>
          <Icon className={cn("h-8 w-8 opacity-20", color)} />
        </div>
        {percentage !== undefined && (
          <Progress value={percentage} className="h-1 mt-2" />
        )}
      </CardContent>
    </Card>
  );
}

export function CerberDashboardPanel() {
  const [entries, setEntries] = useState<CerberLogEntry[]>([]);
  const [stats, setStats] = useState(cerberHistory.getStats());
  const [filter, setFilter] = useState<string>('all');
  const [selectedEntry, setSelectedEntry] = useState<CerberLogEntry | null>(null);

  useEffect(() => {
    const updateData = () => {
      setEntries(cerberHistory.getAll());
      setStats(cerberHistory.getStats());
    };

    updateData();
    const unsubscribe = cerberHistory.subscribe(updateData);
    return unsubscribe;
  }, []);

  const filteredEntries = filter === 'all' 
    ? entries 
    : entries.filter(e => {
        if (filter === 'passed') return e.decision === 'PASS' || e.decision === 'ALLOW';
        if (filter === 'blocked') return e.decision === 'BLOCK';
        if (filter === 'warned') return e.decision === 'REQUIRE_CONFIRM' || e.decision === 'MODIFY';
        return true;
      });

  const handleClear = () => {
    if (confirm('Czy na pewno chcesz wyczyścić historię decyzji Cerbera?')) {
      cerberHistory.clear();
    }
  };

  const passRate = stats.total > 0 
    ? Math.round((stats.passed / stats.total) * 100) 
    : 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Cerber Dashboard</h2>
          <Badge variant="secondary" className="text-xs">
            {stats.total} decyzji
          </Badge>
        </div>
        <Button variant="outline" size="sm" onClick={handleClear}>
          <Trash2 className="h-3 w-3 mr-1" />
          Wyczyść
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard 
          title="Przepuszczone" 
          value={stats.passed} 
          icon={CheckCircle2}
          color="text-green-500"
          percentage={stats.total > 0 ? (stats.passed / stats.total) * 100 : 0}
        />
        <StatCard 
          title="Zablokowane" 
          value={stats.blocked} 
          icon={XCircle}
          color="text-red-500"
          percentage={stats.total > 0 ? (stats.blocked / stats.total) * 100 : 0}
        />
        <StatCard 
          title="Ostrzeżenia" 
          value={stats.confirmed + stats.modified} 
          icon={AlertTriangle}
          color="text-yellow-500"
          percentage={stats.total > 0 ? ((stats.confirmed + stats.modified) / stats.total) * 100 : 0}
        />
        <StatCard 
          title="Pass Rate" 
          value={passRate} 
          icon={TrendingUp}
          color="text-primary"
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history" className="gap-1">
            <Clock className="h-3 w-3" />
            Historia
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-1" disabled={!selectedEntry}>
            <Shield className="h-3 w-3" />
            Szczegóły
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-3">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtruj..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="passed">Przepuszczone</SelectItem>
                <SelectItem value="blocked">Zablokowane</SelectItem>
                <SelectItem value="warned">Ostrzeżenia</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {filteredEntries.length} wyników
            </span>
          </div>

          {/* History List */}
          <Card>
            <ScrollArea className="h-[400px]">
              {filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 opacity-20 mb-4" />
                  <p className="text-sm">Brak decyzji do wyświetlenia</p>
                  <p className="text-xs">Wyślij wiadomość przez ChatPanel aby zobaczyć decyzje Cerbera</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredEntries.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className={cn(
                        "w-full text-left p-3 hover:bg-muted/50 transition-colors",
                        selectedEntry?.id === entry.id && "bg-muted/50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {getDecisionIcon(entry.decision)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getDecisionBadge(entry.decision)}
                            {entry.risk !== undefined && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  entry.risk > 0.7 ? "border-red-500/50 text-red-500" :
                                  entry.risk > 0.4 ? "border-yellow-500/50 text-yellow-500" :
                                  "border-green-500/50 text-green-500"
                                )}
                              >
                                risk: {(entry.risk * 100).toFixed(0)}%
                              </Badge>
                            )}
                            {entry.engine && (
                              <Badge variant="secondary" className="text-xs">
                                {entry.engine}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm truncate">{entry.prompt}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(entry.timestamp)}
                            </span>
                            {entry.flags && entry.flags.length > 0 && (
                              <span className="text-xs text-red-500">
                                🚩 {entry.flags.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="details">
          {selectedEntry && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {getDecisionIcon(selectedEntry.decision)}
                  Szczegóły decyzji
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Decyzja</p>
                    <div className="mt-1">{getDecisionBadge(selectedEntry.decision)}</div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Timestamp</p>
                    <p className="font-mono text-xs mt-1">
                      {new Date(selectedEntry.timestamp).toLocaleString('pl-PL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Intent</p>
                    <p className="mt-1">{selectedEntry.intent || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Risk Score</p>
                    <p className="mt-1">
                      {selectedEntry.risk !== undefined 
                        ? `${(selectedEntry.risk * 100).toFixed(0)}%` 
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Engine</p>
                    <p className="mt-1">{selectedEntry.engine || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Model</p>
                    <p className="mt-1">{selectedEntry.model || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground text-sm mb-1">Prompt</p>
                  <Card className="bg-muted/30 p-3">
                    <p className="text-sm">{selectedEntry.prompt}</p>
                  </Card>
                </div>

                {selectedEntry.flags && selectedEntry.flags.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Flagi</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedEntry.flags.map((flag, i) => (
                        <Badge key={i} variant="destructive" className="text-xs">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEntry.blocked_reason && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Powód blokady</p>
                    <Card className="bg-red-500/10 border-red-500/20 p-3">
                      <p className="text-sm text-red-500">{selectedEntry.blocked_reason}</p>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
