import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Profile fetch error:', error);
    } else {
      setProfile(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [user]);

  const updateDisplayName = async (name: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name })
      .eq('user_id', user.id);
    if (error) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    } else {
      setProfile(prev => prev ? { ...prev, display_name: name } : prev);
      toast({ title: 'Zapisano', description: 'Nazwa zaktualizowana.' });
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast({ title: 'Błąd uploadu', description: uploadError.message, variant: 'destructive' });
      return;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url })
      .eq('user_id', user.id);

    if (updateError) {
      toast({ title: 'Błąd', description: updateError.message, variant: 'destructive' });
    } else {
      setProfile(prev => prev ? { ...prev, avatar_url } : prev);
      toast({ title: 'Avatar zapisany', description: 'Zdjęcie profilowe zaktualizowane.' });
    }
  };

  return { profile, loading, updateDisplayName, uploadAvatar, refetch: fetchProfile };
}
