import { useState } from 'react';
import { MessageSquare, Trash2, Download, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
  model?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ConversationHistoryProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onNewConversation: () => void;
  className?: string;
}

export function ConversationHistory({
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  className,
}: ConversationHistoryProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set(['today']));

  const groupByDate = (convs: Conversation[]) => {
    const groups: Record<string, Conversation[]> = {};
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();

    convs.forEach(conv => {
      const dateStr = conv.updatedAt.toDateString();
      let key: string;

      if (dateStr === today) {
        key = 'today';
      } else if (dateStr === yesterday) {
        key = 'yesterday';
      } else {
        key = conv.updatedAt.toLocaleDateString('pl-PL', { 
          month: 'long', 
          day: 'numeric' 
        });
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(conv);
    });

    return groups;
  };

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const groupedConversations = groupByDate(conversations);
  const dateLabels: Record<string, string> = {
    today: 'Dzisiaj',
    yesterday: 'Wczoraj',
  };

  const exportConversation = (conv: Conversation) => {
    const content = conv.messages
      .map(m => `[${m.role.toUpperCase()}] ${m.content}`)
      .join('\n\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${conv.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Historia rozmów
            <Badge variant="secondary" className="text-xs">
              {conversations.length}
            </Badge>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onNewConversation}>
            <MessageSquare className="h-3 w-3 mr-1" />
            Nowa
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-[300px] pr-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Brak historii rozmów</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(groupedConversations).map(([date, convs]) => (
                <Collapsible
                  key={date}
                  open={expandedDates.has(date)}
                  onOpenChange={() => toggleDate(date)}
                >
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm font-medium text-muted-foreground hover:text-foreground py-1">
                    {expandedDates.has(date) ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    {dateLabels[date] || date}
                    <Badge variant="outline" className="text-xs ml-auto">
                      {convs.length}
                    </Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-1 mt-1">
                    {convs.map(conv => (
                      <div
                        key={conv.id}
                        className={cn(
                          "group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
                          activeConversationId === conv.id
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => onSelectConversation(conv.id)}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {conv.title || 'Rozmowa bez tytułu'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {conv.messages.length} wiadomości
                            {conv.model && ` • ${conv.model}`}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportConversation(conv);
                            }}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteConversation(conv.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
