import { RefreshCw } from 'lucide-react';
 import { LogIn, LogOut, User } from 'lucide-react';
 import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import alfaLogo from '@/assets/alfa-logo.jpeg';
 import { useAuth } from '@/hooks/useAuth';
 import { toast } from '@/hooks/use-toast';

interface HeaderProps {
  isConnected: boolean;
  isChecking: boolean;
  onRefresh: () => void;
}

export function Header({ isConnected, isChecking, onRefresh }: HeaderProps) {
   const { user, signOut, loading } = useAuth();
 
   const handleSignOut = async () => {
     const { error } = await signOut();
     if (error) {
       toast({
         title: 'Błąd',
         description: error.message,
         variant: 'destructive',
       });
     } else {
       toast({
         title: 'Wylogowano',
         description: 'Do zobaczenia!',
       });
     }
   };
 
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <img 
          src={alfaLogo} 
          alt="ALFA AI" 
          className="h-10 w-10 rounded-lg object-cover shadow-lg shadow-primary/20"
        />
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            ALFA <span className="text-primary">Overlay</span>
          </h1>
          <span className="text-xs text-muted-foreground">Nowa Logika AI</span>
        </div>
      </div>
      
       <div className="flex items-center gap-4">
         {!loading && (
           user ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border hover:bg-muted transition-colors"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground truncate max-w-[150px]">
                    {user.email}
                  </span>
                </Link>
               <Button 
                 variant="ghost" 
                 size="sm"
                 onClick={handleSignOut}
                 className="hover:bg-destructive/10 hover:text-destructive"
               >
                 <LogOut className="h-4 w-4 mr-1" />
                 Wyloguj
               </Button>
             </div>
           ) : (
             <Button asChild variant="outline" size="sm">
               <Link to="/auth">
                 <LogIn className="h-4 w-4 mr-1" />
                 Zaloguj się
               </Link>
             </Button>
           )
         )}
 
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border">
          <div 
            className={cn(
              "h-2.5 w-2.5 rounded-full transition-all",
              isConnected 
                ? "bg-primary shadow-sm shadow-primary/50" 
                : "bg-blue-500 shadow-sm shadow-blue-500/50"
            )} 
          />
          <span className="text-xs font-medium text-muted-foreground">
            {isChecking ? 'Sprawdzanie...' : isConnected ? 'Local + Cloud' : '☁️ Cloud'}
          </span>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onRefresh}
          disabled={isChecking}
          className="hover:bg-primary/10 hover:text-primary"
        >
          <RefreshCw className={cn("h-4 w-4", isChecking && "animate-spin")} />
        </Button>
      </div>
    </header>
  );
}
