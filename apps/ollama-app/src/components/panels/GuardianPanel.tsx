 import { useState, useEffect } from 'react';
 import { Shield, AlertTriangle, CheckCircle, XCircle, Activity, Clock, Users, FileText, Building2 } from 'lucide-react';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { Progress } from '@/components/ui/progress';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { 
   getGuardianStats, 
   getAuditLogs, 
   getMetrics,
   getPolicies,
   type AuditLogEntry,
   type GuardianMetrics,
   type GuardianPolicy 
 } from '@/lib/guardian';
 import { cn } from '@/lib/utils';
 import TenantForm from '@/components/guardian/TenantForm';
 import TenantList from '@/components/guardian/TenantList';
 
 // SLA tier colors
 const TIER_COLORS = {
   gold: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
   silver: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
   bronze: 'text-orange-600 bg-orange-500/10 border-orange-500/30',
 };
 
 // Decision colors
 const DECISION_COLORS = {
   ALLOW: 'text-green-500',
   BLOCK: 'text-red-500',
   REQUIRE_CONFIRM: 'text-yellow-500',
   RATE_LIMIT: 'text-orange-500',
 };
 
 export default function GuardianPanel() {
   const [stats, setStats] = useState({
     totalRequests: 0,
     blockedRequests: 0,
     allowedRequests: 0,
     avgConfidence: 0,
     avgLatency: 0,
     blockRate: 0,
   });
   const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
   const [metrics, setMetrics] = useState<GuardianMetrics[]>([]);
   const [policies, setPolicies] = useState<GuardianPolicy[]>([]);
   const [loading, setLoading] = useState(true);
   const [tenantRefresh, setTenantRefresh] = useState(0);
 
   useEffect(() => {
     loadData();
   }, []);
 
   async function loadData() {
     setLoading(true);
     try {
       const [statsData, logsData, metricsData, policiesData] = await Promise.all([
         getGuardianStats(),
         getAuditLogs({ limit: 50 }),
         getMetrics({ days: 7 }),
         getPolicies(),
       ]);
       setStats(statsData);
       setAuditLogs(logsData);
       setMetrics(metricsData);
       setPolicies(policiesData);
     } catch (error) {
       console.error('Failed to load Guardian data:', error);
     }
     setLoading(false);
   }
 
   const formatTime = (dateStr: string) => {
     const date = new Date(dateStr);
     return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
   };
 
   const formatDate = (dateStr: string) => {
     const date = new Date(dateStr);
     return date.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' });
   };
 
   return (
     <div className="h-full flex flex-col gap-4 p-4">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
           <Shield className="h-6 w-6 text-primary" />
           <div>
             <h2 className="text-xl font-bold">Guardian HA</h2>
             <p className="text-xs text-muted-foreground">Control Plane • NOWA-LOGIKA-AI</p>
           </div>
         </div>
         <Button onClick={loadData} variant="outline" size="sm" disabled={loading}>
           {loading ? 'Ładowanie...' : 'Odśwież'}
         </Button>
       </div>
 
       {/* Stats Cards */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
         <Card className="bg-card/50">
           <CardContent className="pt-4">
             <div className="flex items-center gap-2">
               <Activity className="h-4 w-4 text-primary" />
               <span className="text-xs text-muted-foreground">Żądania (30d)</span>
             </div>
             <p className="text-2xl font-bold mt-1">{stats.totalRequests}</p>
           </CardContent>
         </Card>
 
         <Card className="bg-card/50">
           <CardContent className="pt-4">
             <div className="flex items-center gap-2">
               <XCircle className="h-4 w-4 text-red-500" />
               <span className="text-xs text-muted-foreground">Zablokowane</span>
             </div>
             <p className="text-2xl font-bold mt-1 text-red-500">{stats.blockedRequests}</p>
             <p className="text-xs text-muted-foreground">{stats.blockRate.toFixed(1)}% block rate</p>
           </CardContent>
         </Card>
 
         <Card className="bg-card/50">
           <CardContent className="pt-4">
             <div className="flex items-center gap-2">
               <Shield className="h-4 w-4 text-blue-500" />
               <span className="text-xs text-muted-foreground">Śr. Confidence</span>
             </div>
             <p className="text-2xl font-bold mt-1">{(stats.avgConfidence * 100).toFixed(0)}%</p>
             <Progress value={stats.avgConfidence * 100} className="h-1 mt-2" />
           </CardContent>
         </Card>
 
         <Card className="bg-card/50">
           <CardContent className="pt-4">
             <div className="flex items-center gap-2">
               <Clock className="h-4 w-4 text-yellow-500" />
               <span className="text-xs text-muted-foreground">Śr. Latencja</span>
             </div>
             <p className="text-2xl font-bold mt-1">{stats.avgLatency}ms</p>
           </CardContent>
         </Card>
       </div>
 
       {/* Main Content */}
         <Tabs defaultValue="tenants" className="flex-1 flex flex-col">
           <TabsList className="grid w-full grid-cols-4">
             <TabsTrigger value="tenants">Tenanci</TabsTrigger>
           <TabsTrigger value="audit">Audit Log</TabsTrigger>
           <TabsTrigger value="policies">Polityki</TabsTrigger>
           <TabsTrigger value="metrics">Metryki</TabsTrigger>
         </TabsList>
 
           {/* Tenants Tab */}
           <TabsContent value="tenants" className="flex-1 mt-4 space-y-4">
             <TenantForm onSuccess={() => setTenantRefresh(r => r + 1)} />
             <TenantList refreshTrigger={tenantRefresh} />
           </TabsContent>

         {/* Audit Log Tab */}
         <TabsContent value="audit" className="flex-1 mt-4">
           <Card className="h-full">
             <CardHeader className="py-3">
               <CardTitle className="text-sm flex items-center gap-2">
                 <FileText className="h-4 w-4" />
                 Ostatnie decyzje Guardian
               </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
               <ScrollArea className="h-[300px]">
                 {auditLogs.length === 0 ? (
                   <div className="p-4 text-center text-muted-foreground">
                     Brak wpisów w logu
                   </div>
                 ) : (
                   <div className="divide-y divide-border">
                     {auditLogs.map((log) => (
                       <div key={log.id} className="p-3 hover:bg-muted/30 transition-colors">
                         <div className="flex items-center justify-between mb-1">
                           <div className="flex items-center gap-2">
                             {log.decision === 'ALLOW' ? (
                               <CheckCircle className="h-4 w-4 text-green-500" />
                             ) : log.decision === 'BLOCK' ? (
                               <XCircle className="h-4 w-4 text-red-500" />
                             ) : (
                               <AlertTriangle className="h-4 w-4 text-yellow-500" />
                             )}
                             <span className={cn('text-sm font-medium', DECISION_COLORS[log.decision])}>
                               {log.decision}
                             </span>
                             {log.sla_tier && (
                               <Badge variant="outline" className={cn('text-xs', TIER_COLORS[log.sla_tier])}>
                                 {log.sla_tier.toUpperCase()}
                               </Badge>
                             )}
                           </div>
                           <div className="flex items-center gap-2 text-xs text-muted-foreground">
                             <span>{log.latency_ms}ms</span>
                             <span>{formatTime(log.created_at)}</span>
                           </div>
                         </div>
                         {log.input_preview && (
                           <p className="text-xs text-muted-foreground truncate">
                             {log.input_preview}
                           </p>
                         )}
                         {log.confidence_score !== null && log.confidence_score !== undefined && (
                           <div className="mt-1 flex items-center gap-2">
                             <span className="text-xs text-muted-foreground">Confidence:</span>
                             <Progress value={Number(log.confidence_score) * 100} className="h-1 flex-1 max-w-[100px]" />
                             <span className="text-xs">{(Number(log.confidence_score) * 100).toFixed(0)}%</span>
                           </div>
                         )}
                       </div>
                     ))}
                   </div>
                 )}
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
 
         {/* Policies Tab */}
         <TabsContent value="policies" className="flex-1 mt-4">
           <Card className="h-full">
             <CardHeader className="py-3">
               <CardTitle className="text-sm flex items-center gap-2">
                 <Shield className="h-4 w-4" />
                 Aktywne polityki bezpieczeństwa
               </CardTitle>
               <CardDescription className="text-xs">
                 Policy Engine • DLP • Content Filtering
               </CardDescription>
             </CardHeader>
             <CardContent className="p-0">
               <ScrollArea className="h-[300px]">
                 {policies.length === 0 ? (
                   <div className="p-4 text-center text-muted-foreground">
                     <p>Brak zdefiniowanych polityk</p>
                     <p className="text-xs mt-1">DLP patterns są wbudowane</p>
                   </div>
                 ) : (
                   <div className="divide-y divide-border">
                     {policies.map((policy) => (
                       <div key={policy.id} className="p-3 hover:bg-muted/30 transition-colors">
                         <div className="flex items-center justify-between mb-1">
                           <span className="font-medium text-sm">{policy.name}</span>
                           <div className="flex items-center gap-2">
                             <Badge variant={policy.is_active ? 'default' : 'secondary'}>
                               {policy.action}
                             </Badge>
                             <span className="text-xs text-muted-foreground">
                               Priority: {policy.priority}
                             </span>
                           </div>
                         </div>
                         {policy.description && (
                           <p className="text-xs text-muted-foreground">{policy.description}</p>
                         )}
                         <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                           {policy.pattern}
                         </code>
                       </div>
                     ))}
                   </div>
                 )}
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
 
         {/* Metrics Tab */}
         <TabsContent value="metrics" className="flex-1 mt-4">
           <Card className="h-full">
             <CardHeader className="py-3">
               <CardTitle className="text-sm flex items-center gap-2">
                 <Activity className="h-4 w-4" />
                 Metryki dzienne (7 dni)
               </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
               <ScrollArea className="h-[300px]">
                 {metrics.length === 0 ? (
                   <div className="p-4 text-center text-muted-foreground">
                     Brak danych metrycznych
                   </div>
                 ) : (
                   <div className="divide-y divide-border">
                     {metrics.map((m) => (
                       <div key={m.id} className="p-3 hover:bg-muted/30 transition-colors">
                         <div className="flex items-center justify-between mb-2">
                           <span className="font-medium text-sm">{formatDate(m.date)}</span>
                           <span className="text-xs text-muted-foreground">
                             {m.requests_total} żądań
                           </span>
                         </div>
                         <div className="grid grid-cols-4 gap-2 text-xs">
                           <div>
                             <span className="text-muted-foreground">Allowed</span>
                             <p className="text-green-500 font-medium">{m.requests_allowed}</p>
                           </div>
                           <div>
                             <span className="text-muted-foreground">Blocked</span>
                             <p className="text-red-500 font-medium">{m.requests_blocked}</p>
                           </div>
                           <div>
                             <span className="text-muted-foreground">Confidence</span>
                             <p className="font-medium">{(Number(m.avg_confidence) * 100).toFixed(0)}%</p>
                           </div>
                           <div>
                             <span className="text-muted-foreground">Latency</span>
                             <p className="font-medium">{m.avg_latency_ms}ms</p>
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </ScrollArea>
             </CardContent>
           </Card>
         </TabsContent>
       </Tabs>
 
       {/* Footer */}
       <div className="text-center text-xs text-muted-foreground border-t border-border pt-2">
         <p>🛡️ Guardian HA • "Lepiej zapytać niż skłamać" • NOWA-LOGIKA-AI</p>
       </div>
     </div>
   );
 }