import type { TemplateVariables } from '@/types'

/**
 * TemplateEngine — the bottom of the Communication Engine stack. Pure
 * string substitution, no I/O, no dependency on any other communication
 * module. Every other layer (ReminderEngine, QueueManager, CommunicationService)
 * calls into this rather than reimplementing variable replacement.
 *
 * Variables are written in template bodies as {{Variable Name}}, e.g.:
 *   "Hi {{Tenant Name}}, your rent of {{Amount}} for {{Property Name}}
 *    is due on {{Due Date}}."
 */

export const STANDARD_VARIABLES = [
  'Tenant Name',
  'Property Name',
  'Room Number',
  'Amount',
  'Due Date',
  'Owner Name',
] as const

export type StandardVariable = (typeof STANDARD_VARIABLES)[number]

/** Finds every {{Variable}} token in a template body, standard or custom. */
export function extractVariables(body: string): string[] {
  const matches = body.match(/\{\{([^}]+)\}\}/g) ?? []
  return Array.from(new Set(matches.map(m => m.slice(2, -2).trim())))
}

/**
 * Renders a template body against a variable set. Unmatched variables are
 * left as-is (visible as {{Unknown}}) rather than silently blanked out —
 * makes it obvious in a preview if a template references a variable that
 * wasn't supplied, instead of producing a message with a confusing gap.
 */
export function renderTemplate(body: string, variables: TemplateVariables): string {
  return body.replace(/\{\{([^}]+)\}\}/g, (match, key: string) => {
    const trimmed = key.trim()
    const value = variables[trimmed]
    return value !== undefined && value !== '' ? value : match
  })
}

/** True only when every variable the template references has a value. */
export function isFullyRendered(body: string, variables: TemplateVariables): boolean {
  return extractVariables(body).every(key => {
    const value = variables[key]
    return value !== undefined && value !== ''
  })
}
