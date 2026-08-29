import { useState, useEffect } from 'react';
import { FileText, Download, Sparkles, Loader2, File, FileSpreadsheet, Presentation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateFile, downloadFile, getGeneratedFiles, type FileType, type GeneratedFile } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

interface FilesPanelProps {
  isConnected: boolean;
}

const fileTypes: { value: FileType; label: string; icon: React.ElementType }[] = [
  { value: 'pdf', label: 'PDF', icon: FileText },
  { value: 'docx', label: 'Word (.docx)', icon: File },
  { value: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
  { value: 'pptx', label: 'PowerPoint (.pptx)', icon: Presentation },
];

export function FilesPanel({ isConnected }: FilesPanelProps) {
  const [selectedType, setSelectedType] = useState<FileType>('pdf');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setIsLoadingFiles(true);
    const fetchedFiles = await getGeneratedFiles();
    setFiles(fetchedFiles);
    setIsLoadingFiles(false);
  };

  const handleGenerate = async (useAI: boolean) => {
    if (!content.trim() && !useAI) {
      toast({ title: 'Błąd', description: 'Wprowadź treść dokumentu', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const newFile = await generateFile(selectedType, content, useAI);
      setFiles(prev => [newFile, ...prev]);
      setContent('');
      toast({ title: 'Sukces', description: `Wygenerowano plik ${newFile.name}` });
    } catch (error) {
      toast({ 
        title: 'Błąd', 
        description: 'Nie udało się wygenerować pliku. Sprawdź połączenie z ALFA CORE.', 
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (file: GeneratedFile) => {
    try {
      const blob = await downloadFile(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Błąd', description: 'Nie udało się pobrać pliku', variant: 'destructive' });
    }
  };

  const getFileIcon = (type: FileType) => {
    const fileType = fileTypes.find(f => f.value === type);
    const Icon = fileType?.icon || FileText;
    return <Icon className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generator Dokumentów
          </CardTitle>
          <CardDescription>
            Twórz dokumenty PDF, Word, Excel i PowerPoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select 
              value={selectedType} 
              onValueChange={(v) => setSelectedType(v as FileType)}
              disabled={!isConnected}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Wybierz typ" />
              </SelectTrigger>
              <SelectContent>
                {fileTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Textarea
            placeholder="Wprowadź treść dokumentu lub opis dla AI..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            disabled={isGenerating || !isConnected}
          />

          <div className="flex gap-2">
            <Button 
              onClick={() => handleGenerate(false)}
              disabled={isGenerating || !isConnected || !content.trim()}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Generuj
            </Button>
            <Button 
              variant="secondary"
              onClick={() => handleGenerate(true)}
              disabled={isGenerating || !isConnected}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generuj z AI
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wygenerowane Pliki</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingFiles ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Brak wygenerowanych plików
            </p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div 
                  key={file.id} 
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {getFileIcon(file.type)}
                    <div>
                      <p className="font-medium text-sm">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleString('pl-PL')}
                      </p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => handleDownload(file)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
