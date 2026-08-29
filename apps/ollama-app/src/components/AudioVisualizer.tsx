import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface AudioVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  variant?: 'circle' | 'bars' | 'wave';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  barCount?: number;
}

export function AudioVisualizer({ 
  audioLevel, 
  isActive, 
  variant = 'circle',
  size = 'md',
  className,
  barCount = 12
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const barsRef = useRef<number[]>(new Array(barCount).fill(0));

  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
  };

  // Animate bars
  useEffect(() => {
    if (variant !== 'bars') return;

    const animate = () => {
      barsRef.current = barsRef.current.map((bar, i) => {
        const target = isActive 
          ? Math.random() * audioLevel * 100
          : 0;
        return bar + (target - bar) * 0.3;
      });
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, audioLevel, variant]);

  // Wave visualization
  useEffect(() => {
    if (variant !== 'wave' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let offset = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerY = canvas.height / 2;
      const amplitude = isActive ? audioLevel * 30 : 5;
      
      ctx.beginPath();
      ctx.strokeStyle = isActive 
        ? 'hsl(var(--primary))' 
        : 'hsl(var(--muted-foreground) / 0.3)';
      ctx.lineWidth = 2;

      for (let x = 0; x < canvas.width; x++) {
        const y = centerY + 
          Math.sin((x + offset) * 0.05) * amplitude +
          Math.sin((x + offset) * 0.08) * amplitude * 0.5;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      offset += isActive ? 3 : 0.5;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, audioLevel, variant]);

  if (variant === 'circle') {
    return (
      <div className={cn("relative", sizeClasses[size], className)}>
        {/* Outer glow rings */}
        {[0.8, 0.6, 0.4].map((opacity, i) => (
          <div
            key={i}
            className={cn(
              "absolute inset-0 rounded-full transition-all duration-150",
              isActive ? "bg-primary/10" : "bg-muted/20"
            )}
            style={{
              transform: `scale(${1 + (isActive ? audioLevel * (0.3 + i * 0.2) : 0)})`,
              opacity: isActive ? opacity * (0.5 + audioLevel * 0.5) : 0.1,
            }}
          />
        ))}
        
        {/* Inner pulsing ring */}
        <div
          className={cn(
            "absolute inset-2 rounded-full border-2 transition-all duration-100",
            isActive ? "border-primary/60" : "border-muted/40"
          )}
          style={{
            transform: `scale(${1 + (isActive ? audioLevel * 0.15 : 0)})`,
          }}
        />
        
        {/* Core circle */}
        <div
          className={cn(
            "absolute inset-4 rounded-full transition-all duration-75",
            isActive 
              ? "bg-gradient-to-br from-primary to-primary/60 shadow-lg shadow-primary/25" 
              : "bg-muted"
          )}
          style={{
            transform: `scale(${1 + (isActive ? audioLevel * 0.1 : 0)})`,
          }}
        />
      </div>
    );
  }

  if (variant === 'bars') {
    return (
      <div className={cn("flex items-end justify-center gap-1", sizeClasses[size], className)}>
        {barsRef.current.map((height, i) => (
          <div
            key={i}
            className={cn(
              "w-2 rounded-full transition-all duration-75",
              isActive ? "bg-primary" : "bg-muted"
            )}
            style={{
              height: `${Math.max(8, height)}%`,
              opacity: isActive ? 0.6 + (height / 100) * 0.4 : 0.3,
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === 'wave') {
    return (
      <canvas
        ref={canvasRef}
        width={200}
        height={60}
        className={cn("rounded-lg", className)}
      />
    );
  }

  return null;
}
