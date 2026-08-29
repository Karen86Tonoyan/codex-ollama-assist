 /**
  * 🚀 TURBO CONSOLE LOG - ALFA Edition
  * Minimal, typed debugging utilities
  */
 
 export const turbo = {
   router({ engine }: { engine: string }) {
     console.log(`🔧 [LLM Router] Engine: ${engine}`);
   },
 
   cerber({ verdict, score }: { verdict: 'PASS' | 'FAIL'; score?: number }) {
     const ok = verdict === 'PASS';
     console.log(`🐕 [CERBER] ${ok ? '✅' : '❌'} ${verdict}`, score ?? '');
   },
 
   confidence({ score, tier, strict }: {
     score: number;
     tier: 'bronze' | 'silver' | 'gold';
     strict?: boolean;
   }) {
     const pass = score >= 0.6;
     console.log(
       `🛡️ [Confidence Gate] ${pass ? '✅' : '❌'} Score: ${Math.round(score * 100)}%`,
       { tier, strict }
     );
   },
 
   api({ method, path, status }: {
     method: string;
     path: string;
     status: number;
   }) {
     console.log(`📡 [API] ${method} ${path} ${status < 400 ? '✅' : '❌'} ${status}`);
   },
 
   time(label: string) {
     const start = performance.now();
     return () => {
       const end = performance.now();
       console.log(`⏱️ ${label}: ${(end - start).toFixed(2)}ms`);
     };
   },
 };
 
 /** Quick variable log */
 export function tlog(name: string, value: unknown): void {
   console.log(`🚀 ~ ${name}:`, value);
 }