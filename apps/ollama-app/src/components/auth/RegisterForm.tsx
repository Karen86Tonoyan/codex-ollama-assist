import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface RegisterFormProps {
  onSubmit: (email: string, password: string, confirmPassword: string) => void;
  loading: boolean;
}

export function RegisterForm({ onSubmit, loading }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(email, password, confirmPassword);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="register-email">Email</Label>
        <Input id="register-email" type="email" placeholder="twoj@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-password">Hasło</Label>
        <Input id="register-password" type="password" placeholder="Minimum 6 znaków" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="register-confirm">Potwierdź hasło</Label>
        <Input id="register-confirm" type="password" placeholder="Powtórz hasło" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rejestracja...</> : 'Zarejestruj się'}
      </Button>
    </form>
  );
}
