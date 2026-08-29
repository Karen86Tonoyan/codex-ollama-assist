import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Camera, Loader2, Save, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading, updateDisplayName, uploadAvatar } = useProfile();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [nameInitialized, setNameInitialized] = useState(false);

  // Initialize name from profile once loaded
  if (profile && !nameInitialized) {
    setName(profile.display_name || '');
    setNameInitialized(true);
  }

  const handleSaveName = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await updateDisplayName(name.trim());
    setSaving(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      return; // max 2MB
    }
    setUploading(true);
    await uploadAvatar(file);
    setUploading(false);
  };

  const initials = (profile?.display_name || user?.email || '?')
    .slice(0, 2)
    .toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Powrót
        </Button>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Profil użytkownika</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                <Avatar className="h-24 w-24 border-2 border-border">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-xl font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <span className="text-xs text-muted-foreground">Kliknij aby zmienić avatar (max 2MB)</span>
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Nazwa wyświetlana</Label>
              <div className="flex gap-2">
                <Input
                  id="displayName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Twoja nazwa..."
                />
                <Button onClick={handleSaveName} disabled={saving || !name.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Role badge */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Rola:</span>
              <Badge variant={user?.email === 'ktono1986@gmail.com' ? 'default' : 'secondary'}>
                {user?.email === 'ktono1986@gmail.com' ? 'Admin' : 'User'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
