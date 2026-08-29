import { useState, useEffect, useCallback } from 'react';
import { Shield, Users, RefreshCw, Loader2, Ban, UserCheck, Trash2 } from 'lucide-react';
import { ActivityNotifications } from '@/components/admin/ActivityNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  role: string;
  tenant_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

const ADMIN_EMAIL = 'ktono1986@gmail.com';

export function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        method: 'GET',
      });
      if (error) throw error;
      setUsers(data.users || []);
    } catch (err) {
      console.error('Fetch users error:', err);
      toast({ title: 'Błąd', description: 'Nie udało się pobrać listy użytkowników', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);

  const handleSetRole = async (targetUserId: string, role: string) => {
    setActionLoading(targetUserId);
    try {
      const { error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'set_role', target_user_id: targetUserId, role },
      });
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, role } : u));
      toast({ title: 'Zmieniono rolę', description: `Ustawiono: ${role}` });
    } catch {
      toast({ title: 'Błąd', description: 'Nie udało się zmienić roli', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleFreezeUser = async (targetUserId: string, freeze: boolean) => {
    setActionLoading(targetUserId);
    try {
      const { error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'freeze_user', target_user_id: targetUserId, frozen: freeze },
      });
      if (error) throw error;
      toast({ title: freeze ? 'Zablokowano' : 'Odblokowano', description: freeze ? 'Użytkownik nie może się zalogować' : 'Dostęp przywrócony' });
      fetchUsers();
    } catch {
      toast({ title: 'Błąd', description: 'Operacja nie powiodła się', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (targetUserId: string) => {
    setActionLoading(targetUserId);
    try {
      const { error } = await supabase.functions.invoke('admin-users', {
        body: { action: 'delete_user', target_user_id: targetUserId },
      });
      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== targetUserId));
      toast({ title: 'Usunięto', description: 'Konto użytkownika zostało usunięte' });
    } catch {
      toast({ title: 'Błąd', description: 'Nie udało się usunąć użytkownika', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  if (!isAdmin) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <Shield className="h-12 w-12 opacity-30" />
            <p className="font-medium">Brak dostępu</p>
            <p className="text-sm">Panel admina jest dostępny tylko dla administratora systemu.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default' as const;
      case 'operator': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Panel Administratora
                <Badge variant="default">{users.length} użytkowników</Badge>
              </CardTitle>
              <CardDescription>
                Zarządzaj użytkownikami, rolami i dostępem do systemu
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ActivityNotifications />
              <Button variant="outline" size="icon" onClick={fetchUsers} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {users.map((u) => {
                  const isSelf = u.id === user?.id;
                  const initials = (u.display_name || u.email || '?').slice(0, 2).toUpperCase();

                  return (
                    <Card key={u.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                          </Avatar>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">
                                {u.display_name || u.email}
                              </span>
                              <Badge variant={roleBadgeVariant(u.role)} className="text-[10px] shrink-0">
                                {u.role}
                              </Badge>
                              {isSelf && (
                                <Badge variant="outline" className="text-[10px] shrink-0">TY</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Rejestracja: {new Date(u.created_at).toLocaleDateString('pl-PL')}
                              {u.last_sign_in_at && ` • Ostatnie logowanie: ${new Date(u.last_sign_in_at).toLocaleDateString('pl-PL')}`}
                            </p>
                          </div>

                          {/* Actions */}
                          {!isSelf && (
                            <div className="flex items-center gap-2 shrink-0">
                              {/* Role selector */}
                              <Select
                                value={u.role}
                                onValueChange={(val) => handleSetRole(u.id, val)}
                                disabled={actionLoading === u.id}
                              >
                                <SelectTrigger className="w-28 h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="user">User</SelectItem>
                                  <SelectItem value="operator">Operator</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>

                              {/* Freeze/Unfreeze */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1"
                                onClick={() => handleFreezeUser(u.id, true)}
                                disabled={actionLoading === u.id}
                              >
                                <Ban className="h-3 w-3" />
                                Blokuj
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs gap-1"
                                onClick={() => handleFreezeUser(u.id, false)}
                                disabled={actionLoading === u.id}
                              >
                                <UserCheck className="h-3 w-3" />
                              </Button>

                              {/* Delete */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-destructive hover:text-destructive"
                                    disabled={actionLoading === u.id}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Usunąć użytkownika?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Usunięcie konta <strong>{u.email}</strong> jest nieodwracalne. Wszystkie dane zostaną utracone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(u.id)}>
                                      Usuń konto
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}

                          {actionLoading === u.id && (
                            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
