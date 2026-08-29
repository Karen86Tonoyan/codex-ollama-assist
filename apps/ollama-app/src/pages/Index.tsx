import { useState } from 'react';
import { Header } from '@/components/Header';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Footer } from '@/components/Footer';
import { TabNavigation, type TabType } from '@/components/TabNavigation';
import { VoicePanel } from '@/components/panels/VoicePanel';
import { ChatPanel } from '@/components/panels/ChatPanel';
import { OllamaPanel } from '@/components/panels/OllamaPanel';
import { CanvasPanel } from '@/components/panels/CanvasPanel';
import { BrowserPanel } from '@/components/panels/BrowserPanel';
import { ImageGeneratorPanel } from '@/components/panels/ImageGeneratorPanel';
import { AudioBookPanel } from '@/components/panels/AudioBookPanel';
import { AgentPipelinePanel } from '@/components/panels/AgentPipelinePanel';
import { CerberDashboardPanel } from '@/components/panels/CerberDashboardPanel';
import GuardianPanel from '@/components/panels/GuardianPanel';
import { AdminPanel } from '@/components/panels/AdminPanel';
import { FilesPanel } from '@/components/panels/FilesPanel';
import { WorkflowPanel } from '@/components/panels/WorkflowPanel';
import { PluginsPanel } from '@/components/panels/PluginsPanel';
import { MCPPanel } from '@/components/panels/MCPPanel';
import { NodesPanel } from '@/components/panels/NodesPanel';
import { CronPanel } from '@/components/panels/CronPanel';
import { ChannelsPanel } from '@/components/panels/ChannelsPanel';
import { SecurityPanel } from '@/components/panels/SecurityPanel';
import { ProgramsPanel } from '@/components/panels/ProgramsPanel';
import { AppBuilderPanel } from '@/components/panels/AppBuilderPanel';
import { SessionsPanel } from '@/components/panels/SessionsPanel';
import { SkillsPanel } from '@/components/panels/SkillsPanel';
import { N8nPanel } from '@/components/panels/N8nPanel';
import { OllamaAutomationPanel } from '@/components/panels/OllamaAutomationPanel';
import { WebAuditPanel } from '@/components/panels/WebAuditPanel';
import { CameraPanel } from '@/components/panels/CameraPanel';
import { OpenHandsPanel } from '@/components/panels/OpenHandsPanel';
import { CodeServerPanel } from '@/components/panels/CodeServerPanel';
import { SusiChatPanel } from '@/components/panels/SusiChatPanel';
import { LangChainPanel } from '@/components/panels/LangChainPanel';
import { UITarsPanel } from '@/components/panels/UITarsPanel';
import { useConnection } from '@/hooks/useConnection';
import { SupertonicProvider } from '@/components/SupertonicProvider';

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabType>('voice');
  const { 
    isConnected, 
    isChecking, 
    models, 
    activeModel, 
    setActiveModel,
    systemStatus,
    refreshStatus,
  } = useConnection();

  const renderActivePanel = () => {
    switch (activeTab) {
      case 'voice':
        return <VoicePanel isConnected={isConnected} activeModel={activeModel} />;
      case 'chat':
        return <ChatPanel isConnected={isConnected} activeModel={activeModel} />;
      case 'ollama':
        return <OllamaPanel isConnected={isConnected} />;
      case 'canvas':
        return <CanvasPanel isConnected={isConnected} />;
      case 'browser':
        return <BrowserPanel isConnected={isConnected} />;
      case 'image':
        return <ImageGeneratorPanel isConnected={isConnected} />;
      case 'audiobook':
        return <AudioBookPanel />;
      case 'files':
        return <FilesPanel isConnected={isConnected} />;
      case 'programs':
        return <ProgramsPanel isConnected={isConnected} />;
      case 'appbuilder':
        return <AppBuilderPanel />;
      case 'plugins':
        return <PluginsPanel isConnected={isConnected} />;
      case 'mcp':
        return <MCPPanel isConnected={isConnected} />;
      case 'workflow':
        return <WorkflowPanel />;
      case 'n8n':
        return <N8nPanel />;
      case 'langchain':
        return <LangChainPanel />;
      case 'agents':
        return <AgentPipelinePanel />;
      case 'openhands':
        return <OpenHandsPanel />;
      case 'codeserver':
        return <CodeServerPanel />;
      case 'susichat':
        return <SusiChatPanel />;
      case 'ollama-auto':
        return <OllamaAutomationPanel />;
      case 'ui-tars':
        return <UITarsPanel />;
      case 'nodes':
        return <NodesPanel isConnected={isConnected} />;
      case 'channels':
        return <ChannelsPanel isConnected={isConnected} />;
      case 'sessions':
        return <SessionsPanel isConnected={isConnected} />;
      case 'skills':
        return <SkillsPanel isConnected={isConnected} />;
      case 'cron':
        return <CronPanel isConnected={isConnected} />;
      case 'camera':
        return <CameraPanel isConnected={isConnected} />;
      case 'webaudit':
        return <WebAuditPanel isConnected={isConnected} />;
      case 'security':
        return <SecurityPanel isConnected={isConnected} />;
      case 'cerber':
        return <CerberDashboardPanel />;
      case 'guardian':
        return <GuardianPanel />;
      case 'admin':
        return <AdminPanel />;
      default:
        return null;
    }
  };

  return (
    <SupertonicProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Header 
          isConnected={isConnected} 
          isChecking={isChecking}
          onRefresh={refreshStatus}
        />

        <TabNavigation 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
        />

        <main className="flex-1 px-6 py-4">
          <ErrorBoundary key={activeTab}>
            {renderActivePanel()}
          </ErrorBoundary>
        </main>

        <Footer 
          models={models}
          activeModel={activeModel}
          onModelChange={setActiveModel}
          systemStatus={systemStatus}
        />
      </div>
    </SupertonicProvider>
  );
};

export default Index;
