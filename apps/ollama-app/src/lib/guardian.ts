 /**
  * GUARDIAN HA Client
  * Frontend client for Guardian Control Plane
  */
 
 import { supabase } from '@/integrations/supabase/client';
 import { turbo } from './turbo-log';
 
 // Types
 export type SLATier = 'gold' | 'silver' | 'bronze';
 export type GuardianDecision = 'ALLOW' | 'BLOCK' | 'REQUIRE_CONFIRM' | 'RATE_LIMIT';
 
 export interface GuardianResponse {
   decision: GuardianDecision;
   reason?: string;
   matched_policy?: string;
   sla_tier?: string;
   confidence_check?: {
     score: number;
     threshold: number;
     passed: boolean;
   };
 }
 
 export interface Tenant {
   id: string;
   name: string;
   sla_tier: SLATier;
   is_frozen: boolean;
   frozen_reason?: string;
   frozen_at?: string;
   max_tokens_per_request: number;
   rate_limit_per_minute: number;
   created_at: string;
   updated_at: string;
 }
 
 export interface GuardianPolicy {
   id: string;
   tenant_id?: string;
   name: string;
   description?: string;
   pattern: string;
   action: GuardianDecision;
   priority: number;
   is_active: boolean;
   created_at: string;
   updated_at: string;
 }
 
 export interface AuditLogEntry {
   id: string;
   tenant_id?: string;
   user_id?: string;
   request_hash: string;
   decision: GuardianDecision;
   confidence_score?: number;
   matched_policy_id?: string;
   input_preview?: string;
   output_preview?: string;
   latency_ms?: number;
   model_used?: string;
   sla_tier?: SLATier;
   created_at: string;
 }
 
 export interface GuardianMetrics {
   id: string;
   tenant_id?: string;
   date: string;
   requests_total: number;
   requests_blocked: number;
   requests_allowed: number;
   avg_confidence: number;
   avg_latency_ms: number;
   tokens_used: number;
 }
 
 // Get Supabase URL for edge functions
 const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
 
 /**
  * Call Guardian Gate to check if a message is allowed
  */
 export async function checkGuardian(params: {
   message: string;
   tenant_id?: string;
   confidence_score?: number;
   model?: string;
 }): Promise<GuardianResponse> {
   const stopTimer = turbo.time('guardian-gate');
   
   try {
     const { data: { session } } = await supabase.auth.getSession();
     
     const response = await fetch(`${SUPABASE_URL}/functions/v1/guardian-gate`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` }),
       },
       body: JSON.stringify(params),
     });
 
     const result = await response.json();
     stopTimer();
     
     turbo.cerber({
       verdict: result.decision === 'ALLOW' ? 'PASS' : 'FAIL',
       score: result.confidence_check?.score,
     });
     
     return result;
   } catch (error) {
     stopTimer();
     console.error('Guardian Gate error:', error);
     return { decision: 'BLOCK', reason: 'Guardian unavailable' };
   }
 }
 
 /**
  * Get tenants (admin only)
  */
 export async function getTenants(): Promise<Tenant[]> {
   const { data, error } = await supabase
     .from('tenants')
     .select('*')
     .order('created_at', { ascending: false });
   
   if (error) {
     console.error('Failed to fetch tenants:', error);
     return [];
   }
   
   return (data || []) as Tenant[];
 }
 
 /**
  * Create a new tenant
  */
 export async function createTenant(tenant: { name: string; sla_tier?: SLATier }): Promise<Tenant | null> {
   const { data, error } = await supabase
     .from('tenants')
     .insert([tenant])
     .select()
     .single();
   
   if (error) {
     console.error('Failed to create tenant:', error);
     return null;
   }
   
   return data as Tenant;
 }
 
 /**
  * Get policies
  */
 export async function getPolicies(tenantId?: string): Promise<GuardianPolicy[]> {
   let query = supabase
     .from('guardian_policies')
     .select('*')
     .order('priority', { ascending: true });
   
   if (tenantId) {
     query = query.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
   }
   
   const { data, error } = await query;
   
   if (error) {
     console.error('Failed to fetch policies:', error);
     return [];
   }
   
   return (data || []) as GuardianPolicy[];
 }
 
 /**
  * Create a new policy
  */
 export async function createPolicy(policy: { 
   name: string; 
   pattern: string; 
   action?: GuardianDecision;
   tenant_id?: string;
   description?: string;
   priority?: number;
 }): Promise<GuardianPolicy | null> {
   const { data, error } = await supabase
     .from('guardian_policies')
     .insert([policy])
     .select()
     .single();
   
   if (error) {
     console.error('Failed to create policy:', error);
     return null;
   }
   
   return data as GuardianPolicy;
 }
 
 /**
  * Get audit logs
  */
 export async function getAuditLogs(params?: {
   tenantId?: string;
   limit?: number;
   decision?: GuardianDecision;
 }): Promise<AuditLogEntry[]> {
   let query = supabase
     .from('guardian_audit_log')
     .select('*')
     .order('created_at', { ascending: false })
     .limit(params?.limit || 100);
   
   if (params?.tenantId) {
     query = query.eq('tenant_id', params.tenantId);
   }
   
   if (params?.decision) {
     query = query.eq('decision', params.decision);
   }
   
   const { data, error } = await query;
   
   if (error) {
     console.error('Failed to fetch audit logs:', error);
     return [];
   }
   
   return (data || []) as AuditLogEntry[];
 }
 
 /**
  * Get metrics
  */
 export async function getMetrics(params?: {
   tenantId?: string;
   days?: number;
 }): Promise<GuardianMetrics[]> {
   const daysAgo = params?.days || 7;
   const startDate = new Date();
   startDate.setDate(startDate.getDate() - daysAgo);
   
   let query = supabase
     .from('guardian_metrics')
     .select('*')
     .gte('date', startDate.toISOString().split('T')[0])
     .order('date', { ascending: true });
   
   if (params?.tenantId) {
     query = query.eq('tenant_id', params.tenantId);
   }
   
   const { data, error } = await query;
   
   if (error) {
     console.error('Failed to fetch metrics:', error);
     return [];
   }
   
   return (data || []) as GuardianMetrics[];
 }
 
 /**
  * Get summary stats
  */
 export async function getGuardianStats(tenantId?: string): Promise<{
   totalRequests: number;
   blockedRequests: number;
   allowedRequests: number;
   avgConfidence: number;
   avgLatency: number;
   blockRate: number;
 }> {
   const metrics = await getMetrics({ tenantId, days: 30 });
   
   const totals = metrics.reduce((acc, m) => ({
     totalRequests: acc.totalRequests + m.requests_total,
     blockedRequests: acc.blockedRequests + m.requests_blocked,
     allowedRequests: acc.allowedRequests + m.requests_allowed,
     avgConfidence: acc.avgConfidence + (m.avg_confidence * m.requests_total),
     avgLatency: acc.avgLatency + (m.avg_latency_ms * m.requests_total),
   }), {
     totalRequests: 0,
     blockedRequests: 0,
     allowedRequests: 0,
     avgConfidence: 0,
     avgLatency: 0,
   });
   
   return {
     totalRequests: totals.totalRequests,
     blockedRequests: totals.blockedRequests,
     allowedRequests: totals.allowedRequests,
     avgConfidence: totals.totalRequests > 0 ? totals.avgConfidence / totals.totalRequests : 0,
     avgLatency: totals.totalRequests > 0 ? Math.round(totals.avgLatency / totals.totalRequests) : 0,
     blockRate: totals.totalRequests > 0 ? (totals.blockedRequests / totals.totalRequests) * 100 : 0,
   };
 }