 import { useState } from 'react';
 import { Building2, Plus, Crown, Award, Medal } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { createTenant, type SLATier } from '@/lib/guardian';
 import { toast } from 'sonner';
 import { cn } from '@/lib/utils';
 
 const SLA_TIERS: { value: SLATier; label: string; icon: typeof Crown; description: string; color: string }[] = [
   {
     value: 'gold',
     label: 'Gold',
     icon: Crown,
     description: 'Confidence ≥ 55%, 200 req/min, 4000 tokens',
     color: 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10',
   },
   {
     value: 'silver',
     label: 'Silver',
     icon: Award,
     description: 'Confidence ≥ 48%, 100 req/min, 2000 tokens',
     color: 'text-gray-400 border-gray-400/50 bg-gray-400/10',
   },
   {
     value: 'bronze',
     label: 'Bronze',
     icon: Medal,
     description: 'Confidence ≥ 40%, 50 req/min, 1000 tokens',
     color: 'text-orange-500 border-orange-500/50 bg-orange-500/10',
   },
 ];
 
 interface TenantFormProps {
   onSuccess?: () => void;
 }
 
 export default function TenantForm({ onSuccess }: TenantFormProps) {
   const [name, setName] = useState('');
   const [slaTier, setSlaTier] = useState<SLATier>('bronze');
   const [isSubmitting, setIsSubmitting] = useState(false);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     const trimmedName = name.trim();
     if (!trimmedName) {
       toast.error('Nazwa tenanta jest wymagana');
       return;
     }
     
     if (trimmedName.length > 100) {
       toast.error('Nazwa tenanta nie może przekraczać 100 znaków');
       return;
     }
 
     setIsSubmitting(true);
     try {
       const tenant = await createTenant({ name: trimmedName, sla_tier: slaTier });
       if (tenant) {
         toast.success(`Tenant "${tenant.name}" utworzony z tier ${slaTier.toUpperCase()}`);
         setName('');
         setSlaTier('bronze');
         onSuccess?.();
       } else {
         toast.error('Nie udało się utworzyć tenanta. Sprawdź uprawnienia.');
       }
     } catch (error) {
       console.error('Create tenant error:', error);
       toast.error('Błąd podczas tworzenia tenanta');
     }
     setIsSubmitting(false);
   };
 
   return (
     <Card className="bg-card/50">
       <CardHeader className="py-3">
         <CardTitle className="text-sm flex items-center gap-2">
           <Building2 className="h-4 w-4" />
           Nowy Tenant
         </CardTitle>
         <CardDescription className="text-xs">
           Utwórz organizację z przypisanym tier SLA
         </CardDescription>
       </CardHeader>
       <CardContent>
         <form onSubmit={handleSubmit} className="space-y-4">
           {/* Name Input */}
           <div className="space-y-2">
             <Label htmlFor="tenant-name" className="text-xs">
               Nazwa organizacji
             </Label>
             <Input
               id="tenant-name"
               value={name}
               onChange={(e) => setName(e.target.value)}
               placeholder="np. Acme Corp"
               maxLength={100}
               className="h-8 text-sm"
               disabled={isSubmitting}
             />
           </div>
 
           {/* SLA Tier Selection */}
           <div className="space-y-2">
             <Label className="text-xs">SLA Tier</Label>
             <RadioGroup
               value={slaTier}
               onValueChange={(v) => setSlaTier(v as SLATier)}
               className="grid grid-cols-3 gap-2"
             >
               {SLA_TIERS.map((tier) => {
                 const Icon = tier.icon;
                 const isSelected = slaTier === tier.value;
                 return (
                   <Label
                     key={tier.value}
                     htmlFor={`tier-${tier.value}`}
                     className={cn(
                       'flex flex-col items-center gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all',
                       isSelected ? tier.color : 'border-border hover:border-muted-foreground/50'
                     )}
                   >
                     <RadioGroupItem
                       value={tier.value}
                       id={`tier-${tier.value}`}
                       className="sr-only"
                     />
                     <Icon className={cn('h-5 w-5', isSelected ? '' : 'text-muted-foreground')} />
                     <span className={cn('text-xs font-medium', isSelected ? '' : 'text-muted-foreground')}>
                       {tier.label}
                     </span>
                   </Label>
                 );
               })}
             </RadioGroup>
             <p className="text-xs text-muted-foreground mt-1">
               {SLA_TIERS.find(t => t.value === slaTier)?.description}
             </p>
           </div>
 
           {/* Submit Button */}
           <Button
             type="submit"
             size="sm"
             className="w-full"
             disabled={isSubmitting || !name.trim()}
           >
             <Plus className="h-4 w-4 mr-1" />
             {isSubmitting ? 'Tworzenie...' : 'Utwórz Tenant'}
           </Button>
         </form>
       </CardContent>
     </Card>
   );
 }