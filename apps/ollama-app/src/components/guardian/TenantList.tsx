 import { useState, useEffect } from 'react';
 import { Building2, Crown, Award, Medal, Snowflake, RefreshCw } from 'lucide-react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { getTenants, type Tenant, type SLATier } from '@/lib/guardian';
 import { cn } from '@/lib/utils';
 
 const TIER_CONFIG: Record<SLATier, { icon: typeof Crown; color: string }> = {
   gold: { icon: Crown, color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30' },
   silver: { icon: Award, color: 'text-gray-400 bg-gray-400/10 border-gray-400/30' },
   bronze: { icon: Medal, color: 'text-orange-500 bg-orange-500/10 border-orange-500/30' },
 };
 
 interface TenantListProps {
   refreshTrigger?: number;
 }
 
 export default function TenantList({ refreshTrigger }: TenantListProps) {
   const [tenants, setTenants] = useState<Tenant[]>([]);
   const [loading, setLoading] = useState(true);
 
   const loadTenants = async () => {
     setLoading(true);
     const data = await getTenants();
     setTenants(data);
     setLoading(false);
   };
 
   useEffect(() => {
     loadTenants();
   }, [refreshTrigger]);
 
   const formatDate = (dateStr: string) => {
     return new Date(dateStr).toLocaleDateString('pl-PL', {
       day: '2-digit',
       month: 'short',
       year: 'numeric',
     });
   };
 
   return (
     <Card className="bg-card/50">
       <CardHeader className="py-3 flex flex-row items-center justify-between">
         <CardTitle className="text-sm flex items-center gap-2">
           <Building2 className="h-4 w-4" />
           Tenanci ({tenants.length})
         </CardTitle>
         <Button variant="ghost" size="icon" className="h-6 w-6" onClick={loadTenants} disabled={loading}>
           <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
         </Button>
       </CardHeader>
       <CardContent className="p-0">
         <ScrollArea className="h-[200px]">
           {tenants.length === 0 ? (
             <div className="p-4 text-center text-muted-foreground text-sm">
               {loading ? 'Ładowanie...' : 'Brak tenantów. Utwórz pierwszego powyżej.'}
             </div>
           ) : (
             <div className="divide-y divide-border">
               {tenants.map((tenant) => {
                 const tierConfig = TIER_CONFIG[tenant.sla_tier];
                 const TierIcon = tierConfig.icon;
                 return (
                   <div key={tenant.id} className="p-3 hover:bg-muted/30 transition-colors">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <span className="font-medium text-sm">{tenant.name}</span>
                         {tenant.is_frozen && (
                           <Snowflake className="h-3 w-3 text-blue-400" />
                         )}
                       </div>
                       <Badge variant="outline" className={cn('text-xs', tierConfig.color)}>
                         <TierIcon className="h-3 w-3 mr-1" />
                         {tenant.sla_tier.toUpperCase()}
                       </Badge>
                     </div>
                     <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                       <span>{tenant.rate_limit_per_minute} req/min</span>
                       <span>•</span>
                       <span>{tenant.max_tokens_per_request} tokens</span>
                       <span>•</span>
                       <span>{formatDate(tenant.created_at)}</span>
                     </div>
                   </div>
                 );
               })}
             </div>
           )}
         </ScrollArea>
       </CardContent>
     </Card>
   );
 }