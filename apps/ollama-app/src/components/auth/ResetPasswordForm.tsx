import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface ResetPasswordFormProps {
  onSubmit: (email: string) => void;
  onBack: () => void;
  loading: boolean;
}

export function ResetPasswordForm({ onSubmit, onBack, loading }: ResetPasswordFormProps) {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input id="reset-email" type="email" placeholder="twoj@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Wysyłanie...</> : 'Wyślij link do resetowania'}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        Wróć do logowania
      </Button>
    </form>
  );
}
