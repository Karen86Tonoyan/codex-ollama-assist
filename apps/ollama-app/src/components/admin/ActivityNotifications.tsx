import { useState, useEffect, useRef } from 'react';
import { Bell, X, LogIn, UserPlus, ShieldAlert, Trash2, Ban, UserCheck, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

interface ActivityEvent {
  id: string;
  user_id: string;
  user_email: string | null;
  event_type: string;
  details: string | null;
  created_at: string;
}

const EVENT_ICONS: Record<string, typeof LogIn> = {
  sign_in: LogIn,
  sign_up: UserPlus,
  role_change: Settings,
  freeze: Ban,
  unfreeze: UserCheck,
  delete_user: Trash2,
  security: ShieldAlert,
};

const EVENT_COLORS: Record<string, string> = {
  sign_in: 'text-green-500',
  sign_up: 'text-blue-500',
  role_change: 'text-yellow-500',
  freeze: 'text-red-500',
  unfreeze: 'text-emerald-500',
  delete_user: 'text-destructive',
  security: 'text-orange-500',
};

export function ActivityNotifications() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Fetch recent activity
    const fetchRecent = async () => {
      const { data } = await supabase
        .from('user_activity')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setEvents(data as ActivityEvent[]);
    };
    fetchRecent();

    // Subscribe to realtime
    const channel = supabase
      .channel('admin-activity')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_activity' },
        (payload) => {
          const newEvent = payload.new as ActivityEvent;
          setEvents(prev => [newEvent, ...prev].slice(0, 100));
          setUnread(prev => prev + 1);
          // Play subtle notification sound
          try {
            audioRef.current?.play();
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) setUnread(0);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'teraz';
    if (mins < 60) return `${mins}m temu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h temu`;
    return `${Math.floor(hours / 24)}d temu`;
  };

  return (
    <>
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZeXk4x/cGRbVVNXX2p2goyVm5uXkYR3amBXUlFWYGx5hI+Ym5qVjYF0Z11UUFBVYm16h5KampmUi390Zl1UUVNZY258iZKYmZeRiHxuY1pTU1hfanmGkJiampaSiHxuYllSU1lgbHuIkpiampWQhXltYllTVFpia3yIkpiamZSOhHltYVlUVFlib3yJk5qamZSNgnlsYFhTU1dgbHuIkpiamZSNg3ltYFhTU1ZgbHuHkZiamZSOhHptYFhTVFdia3yIkpiamZSOhHlsYFhTVFhfbHuIk5qamZSOg3lsYFhTVFhgbHuIk5qamZWOhHptYFhTU1dgbHuIkpiamZWOhHptYFlTVFhgbHuIk5iamZWOhHptYFhTU1dgbHuIk5iamZSOhHlsYFlTVFhgbHuIk5iamZSO" preload="auto" />
      <Popover open={open} onOpenChange={handleOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 text-[10px] flex items-center justify-center rounded-full"
              >
                {unread > 99 ? '99+' : unread}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="text-sm font-semibold">Aktywność użytkowników</span>
            {events.length > 0 && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setEvents([])}>
                Wyczyść
              </Button>
            )}
          </div>
          <ScrollArea className="h-72">
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-20 mb-2" />
                <p className="text-xs">Brak aktywności</p>
              </div>
            ) : (
              <div className="divide-y">
                {events.map((e) => {
                  const Icon = EVENT_ICONS[e.event_type] || Bell;
                  const color = EVENT_COLORS[e.event_type] || 'text-muted-foreground';
                  return (
                    <div key={e.id} className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {e.user_email || e.user_id.slice(0, 8)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{e.details || e.event_type}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {timeAgo(e.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </>
  );
}
