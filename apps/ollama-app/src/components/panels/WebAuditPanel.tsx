import { useState } from 'react';
import { Shield, Search, Download, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { scanWebsite, exportAuditReport, type AuditResult } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface WebAuditPanelProps {
  isConnected: boolean;
}

export function WebAuditPanel({ isConnected }: WebAuditPanelProps) {
  const [url, setUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [result, setResult] = useState<AuditResult | null>(null);

  const isValidUrl = (urlString: string) => {
    try {
      const parsed = new URL(urlString.startsWith('http') ? urlString : `https://${urlString}`);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleScan = async (mode: 'quick' | 'full') => {
    if (!isValidUrl(url)) {
      toast({ title: 'Błąd', description: 'Podaj prawidłowy adres URL', variant: 'destructive' });
      return;
    }

    const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    
    setIsScanning(true);
    setScanProgress(0);
    setResult(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setScanProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      const auditResult = await scanWebsite(normalizedUrl, mode);
      setResult(auditResult);
      setScanProgress(100);
      toast({ title: 'Sukces', description: 'Skanowanie zakończone' });
    } catch (error) {
      toast({ 
        title: 'Błąd', 
        description: 'Nie udało się przeprowadzić audytu. Sprawdź połączenie z ALFA CORE.', 
        variant: 'destructive' 
      });
    } finally {
      clearInterval(progressInterval);
      setIsScanning(false);
    }
  };

  const handleExport = async () => {
    if (!result) return;

    try {
      const blob = await exportAuditReport(result);
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `audit-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      toast({ title: 'Sukces', description: 'Raport został pobrany' });
    } catch {
      toast({ title: 'Błąd', description: 'Nie udało się wyeksportować raportu', variant: 'destructive' });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audyt Bezpieczeństwa
          </CardTitle>
          <CardDescription>
            Skanowanie stron internetowych pod kątem bezpieczeństwa, SSL i SEO
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isScanning || !isConnected}
            />
            <Button 
              onClick={() => handleScan('quick')} 
              disabled={isScanning || !isConnected || !url}
            >
              {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Szybki
            </Button>
            <Button 
              variant="secondary"
              onClick={() => handleScan('full')} 
              disabled={isScanning || !isConnected || !url}
            >
              Pełny audyt
            </Button>
          </div>

          {isScanning && (
            <div className="space-y-2">
              <Progress value={scanProgress} />
              <p className="text-sm text-muted-foreground text-center">
                Skanowanie... {scanProgress}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Score Overview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Wynik: {result.score}/100</CardTitle>
                <CardDescription>{result.url}</CardDescription>
              </div>
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Eksport PDF
              </Button>
            </CardHeader>
            <CardContent>
              <Progress value={result.score} className="h-3" />
            </CardContent>
          </Card>

          {/* SSL Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {result.ssl.valid ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                SSL/TLS
              </CardTitle>
            </CardHeader>
            <CardContent>
              {result.ssl.valid ? (
                <div className="text-sm text-muted-foreground">
                  <p>Wystawca: {result.ssl.issuer || 'N/A'}</p>
                  <p>Wygasa: {result.ssl.expiresAt || 'N/A'}</p>
                </div>
              ) : (
                <p className="text-sm text-destructive">Brak ważnego certyfikatu SSL</p>
              )}
            </CardContent>
          </Card>

          {/* Security Headers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nagłówki Bezpieczeństwa</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {result.headers.map((header, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                    <span className="font-mono text-sm">{header.name}</span>
                    {header.present ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Vulnerabilities */}
          {result.vulnerabilities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Wykryte Podatności ({result.vulnerabilities.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {result.vulnerabilities.map((vuln, i) => (
                    <div key={i} className="p-3 rounded-md border">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getSeverityColor(vuln.severity)}>
                          {vuln.severity.toUpperCase()}
                        </Badge>
                        <span className="font-medium">{vuln.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{vuln.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SEO Score: {result.seo.score}/100</CardTitle>
            </CardHeader>
            <CardContent>
              {result.seo.issues.length > 0 ? (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {result.seo.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-green-600">Brak problemów SEO</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!isConnected && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Brak połączenia z ALFA CORE. Uruchom backend na localhost:8000
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
