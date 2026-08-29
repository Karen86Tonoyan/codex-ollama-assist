import { useState, useRef, useCallback, useEffect } from 'react';

interface CameraState {
  isActive: boolean;
  devices: MediaDeviceInfo[];
  activeDeviceId: string;
  error: string | null;
}

export function useCamera() {
  const [state, setState] = useState<CameraState>({
    isActive: false,
    devices: [],
    activeDeviceId: '',
    error: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pobierz listę kamer
  const getDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setState(prev => ({ 
        ...prev, 
        devices: videoDevices,
        activeDeviceId: videoDevices[0]?.deviceId || '',
      }));
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
    }
  }, []);

  // Uruchom kamerę
  const startCamera = useCallback(async (deviceId?: string) => {
    try {
      // Zatrzymaj poprzedni stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } }
          : { facingMode: 'environment' },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setState(prev => ({ 
        ...prev, 
        isActive: true, 
        error: null,
        activeDeviceId: deviceId || prev.activeDeviceId,
      }));
    } catch (error) {
      console.error('Failed to start camera:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Nie można uruchomić kamery',
        isActive: false,
      }));
    }
  }, []);

  // Zatrzymaj kamerę
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  // Przechwyć klatkę
  const captureFrame = useCallback((): Blob | null => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    // Konwertuj na Blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.9);
    }) as unknown as Blob;
  }, []);

  // Asynchroniczna wersja captureFrame
  const captureFrameAsync = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  }, []);

  // Zmień kamerę
  const switchCamera = useCallback((deviceId: string) => {
    if (state.isActive) {
      startCamera(deviceId);
    } else {
      setState(prev => ({ ...prev, activeDeviceId: deviceId }));
    }
  }, [state.isActive, startCamera]);

  // Pobierz urządzenia przy inicjalizacji
  useEffect(() => {
    getDevices();
  }, [getDevices]);

  // Cleanup przy odmontowaniu
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return {
    ...state,
    videoRef,
    canvasRef,
    startCamera,
    stopCamera,
    captureFrame,
    captureFrameAsync,
    switchCamera,
    refreshDevices: getDevices,
  };
}
