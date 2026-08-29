import { useState, useEffect, useCallback } from 'react';
import { checkConnection, getModels, getSystemStatus, type Model, type SystemStatus } from '@/lib/api';

export function useConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [models, setModels] = useState<Model[]>([]);
  const [activeModel, setActiveModel] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({ connected: false });

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      const connected = await checkConnection();
      setIsConnected(connected);

      if (connected) {
        const [fetchedModels, status] = await Promise.all([
          getModels(),
          getSystemStatus(),
        ]);
        setModels(fetchedModels);
        setSystemStatus(status);
        
        if (fetchedModels.length > 0 && !activeModel) {
          setActiveModel(fetchedModels[0].id);
        }
      }
    } catch (error) {
      console.error('Connection check failed:', error);
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  }, [activeModel]);

  useEffect(() => {
    checkStatus();
    
    // Sprawdzaj połączenie co 10 sekund
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return {
    isConnected,
    isChecking,
    models,
    activeModel,
    setActiveModel,
    systemStatus,
    refreshStatus: checkStatus,
  };
}
