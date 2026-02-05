import { supabase } from '../lib/supabase.js'

export type AdminAuditAction = {
  actorId: string
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, any>
  ipAddress?: string | null
  userAgent?: string | null
}

export async function logAdminAction({
  actorId,
  action,
  targetType,
  targetId,
  metadata,
  ipAddress,
  userAgent,
}: AdminAuditAction): Promise<void> {
  const { error } = await supabase
    .from('admin_audit_logs')
    .insert({
      actor_id: actorId,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      metadata: metadata || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
    })

  if (error) {
    console.error('Failed to write admin audit log:', error)
  }
}
