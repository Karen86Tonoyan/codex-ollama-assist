import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface UpdatePasswordFormProps {
  onSubmit: (newPassword: string, confirmPassword: string) => void;
  loading: boolean;
}

export function UpdatePasswordForm({ onSubmit, loading }: UpdatePasswordFormProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(newPassword, confirmPassword);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password">Nowe hasło</Label>
        <Input id="new-password" type="password" placeholder="Minimum 6 znaków" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-new-password">Potwierdź hasło</Label>
        <Input id="confirm-new-password" type="password" placeholder="Powtórz hasło" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Zapisywanie...</> : 'Ustaw nowe hasło'}
      </Button>
    </form>
  );
}
