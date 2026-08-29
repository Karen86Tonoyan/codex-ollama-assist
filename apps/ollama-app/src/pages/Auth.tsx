import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';
import { GoogleButton } from '@/components/auth/GoogleButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect authenticated users to home (unless in recovery mode)
  useEffect(() => {
    if (!authLoading && user && !isRecovery) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, isRecovery, navigate]);

  // Detect password recovery from URL params AND auth state change
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'recovery') {
      setIsRecovery(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result && 'error' in result && result.error) {
        toast({ title: 'Błąd logowania Google', description: String(result.error.message || result.error), variant: 'destructive' });
        setGoogleLoading(false);
      }
      // If redirected, page will reload — no need to reset loading
    } catch (err) {
      toast({ title: 'Błąd logowania Google', description: 'Nie udało się połączyć z Google', variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast({ title: 'Błąd logowania', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Zalogowano pomyślnie', description: 'Witaj ponownie!' });
      navigate('/', { replace: true });
    }
    setLoading(false);
  };

  const handleRegister = async (email: string, password: string, confirmPassword: string) => {
    if (password !== confirmPassword) {
      toast({ title: 'Błąd', description: 'Hasła nie są identyczne', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Błąd', description: 'Hasło musi mieć minimum 6 znaków', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password);
    if (error) {
      toast({ title: 'Błąd rejestracji', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Rejestracja udana', description: 'Sprawdź swoją skrzynkę email aby potwierdzić konto.' });
    }
    setLoading(false);
  };

  const handleResetPassword = async (email: string) => {
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?type=recovery`,
    });
    if (error) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Email wysłany', description: 'Sprawdź skrzynkę — kliknij link aby ustawić nowe hasło.' });
      setShowReset(false);
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (newPassword: string, confirmPassword: string) => {
    if (newPassword !== confirmPassword) {
      toast({ title: 'Błąd', description: 'Hasła nie są identyczne', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Błąd', description: 'Hasło musi mieć minimum 6 znaków', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: 'Błąd', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Hasło zmienione', description: 'Możesz się teraz zalogować nowym hasłem.' });
      setIsRecovery(false);
      navigate('/', { replace: true });
    }
    setLoading(false);
  };

  // Show loader while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Nowe hasło</CardTitle>
            <CardDescription>Ustaw nowe hasło do swojego konta</CardDescription>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm onSubmit={handleUpdatePassword} loading={loading} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">ALFA Overlay</CardTitle>
          <CardDescription>Zaloguj się lub utwórz nowe konto</CardDescription>
        </CardHeader>
        <CardContent>
          {showReset ? (
            <ResetPasswordForm
              onSubmit={handleResetPassword}
              onBack={() => setShowReset(false)}
              loading={loading}
            />
          ) : (
            <div className="space-y-4">
              <GoogleButton onClick={handleGoogleSignIn} loading={googleLoading} />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">lub</span>
                </div>
              </div>

              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Logowanie</TabsTrigger>
                  <TabsTrigger value="register">Rejestracja</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <LoginForm onSubmit={handleLogin} onForgotPassword={() => setShowReset(true)} loading={loading} />
                </TabsContent>

                <TabsContent value="register">
                  <RegisterForm onSubmit={handleRegister} loading={loading} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
