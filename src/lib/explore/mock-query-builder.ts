import { requestExploreLock } from './lock-bus'

type Row = Record<string, any>
type Store = Record<string, Row[]>

// FK column name for a naive embedded-relation resolver, e.g.
// `.select('*, room:rooms(room_number)')` -> looks up `row.room_id` in
// store.rooms. Covers the relation shapes actually seeded for Explore
// Mode; anything outside this map degrades to an empty embed rather than
// throwing, since a missing nested field is far less disruptive to a
// read-only exploration screen than a crash.
const FK_COLUMN: Record<string, string> = {
  properties: 'property_id',
  rooms: 'room_id',
  tenants: 'tenant_id',
  profiles: 'owner_id',
}

// RPC functions that only ever read data — everything else is treated as
// a mutation (matches how this codebase actually uses rpc(): the other
// three calls all create a tenant login, which is a write).
const READ_ONLY_RPCS = new Set(['get_cotenant_birthdays'])

/** Splits a Postgrest select string on top-level commas only (parens for embeds aren't split). */
function splitTopLevel(input: string): string[] {
  const parts: string[] = []
  let depth = 0, current = ''
  for (const ch of input) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(current.trim()); current = '' }
    else current += ch
  }
  if (current.trim()) parts.push(current.trim())
  return parts
}

/** Extracts the content between an embed's outer parens, respecting nested parens. */
function innerParenContent(part: string): string | null {
  const start = part.indexOf('(')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < part.length; i++) {
    if (part[i] === '(') depth++
    if (part[i] === ')') {
      depth--
      if (depth === 0) return part.slice(start + 1, i)
    }
  }
  return null
}

function applyEmbeds(row: Row, selectStr: string | undefined, store: Store): Row {
  if (!selectStr || !selectStr.includes('(')) return row
  const out = { ...row }
  for (const part of splitTopLevel(selectStr)) {
    const m = part.match(/^(\w+):?(\w+)?\(/)
    if (!m) continue
    const alias = m[1]
    const table = m[2] || m[1]
    const fk = FK_COLUMN[table]
    if (!fk || !store[table]) continue
    const match = store[table].find(r => r.id === row[fk]) ?? null
    // Recurse so a further-nested embed inside this one (e.g. the `room`
    // inside `tenant:tenants(..., room:rooms(room_number))` pattern
    // getPayments() actually uses) resolves too, not just the first level.
    const innerSelect = innerParenContent(part)
    out[alias] = match ? applyEmbeds(match, innerSelect ?? undefined, store) : null
  }
  return out
}

function matchOrFilter(row: Row, orString: string): boolean {
  // Handles the simple comma-separated "col.op.value" shape this codebase
  // actually uses — not the full Postgrest grammar.
  return orString.split(',').some(clause => {
    const [col, op, ...rest] = clause.split('.')
    const val = rest.join('.')
    if (op === 'eq') return String(row[col]) === val
    if (op === 'neq') return String(row[col]) !== val
    return false
  })
}

class MockQueryBuilder {
  private table: string
  private store: Store
  private filters: Array<(row: Row) => boolean> = []
  private selectStr?: string
  private sort?: { col: string; ascending: boolean }
  private limitN?: number
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select'
  private payload: Row | Row[] | null = null
  private wantSingle = false
  private wantMaybeSingle = false

  constructor(table: string, store: Store) {
    this.table = table
    this.store = store
  }

  select(cols?: string) { this.selectStr = cols; return this }
  eq(col: string, val: any) { this.filters.push(r => r[col] === val); return this }
  neq(col: string, val: any) { this.filters.push(r => r[col] !== val); return this }
  in(col: string, vals: any[]) { this.filters.push(r => vals.includes(r[col])); return this }
  gte(col: string, val: any) { this.filters.push(r => r[col] >= val); return this }
  lte(col: string, val: any) { this.filters.push(r => r[col] <= val); return this }
  gt(col: string, val: any) { this.filters.push(r => r[col] > val); return this }
  lt(col: string, val: any) { this.filters.push(r => r[col] < val); return this }
  ilike(col: string, pattern: string) {
    const re = new RegExp(pattern.replace(/%/g, '.*'), 'i')
    this.filters.push(r => re.test(String(r[col] ?? '')))
    return this
  }
  not() { return this } // not commonly used for exclusion logic that matters to read-only screens; no-op is safer than a wrong filter
  or(str: string) { this.filters.push(r => matchOrFilter(r, str)); return this }
  order(col: string, opts?: { ascending?: boolean }) { this.sort = { col, ascending: opts?.ascending ?? true }; return this }
  limit(n: number) { this.limitN = n; return this }
  range() { return this }
  single() { this.wantSingle = true; return this }
  maybeSingle() { this.wantMaybeSingle = true; return this }

  insert(payload: Row | Row[]) { this.mode = 'insert'; this.payload = payload; return this }
  update(payload: Row) { this.mode = 'update'; this.payload = payload; return this }
  upsert(payload: Row | Row[]) { this.mode = 'upsert'; this.payload = payload; return this }
  delete() { this.mode = 'delete'; return this }

  private runSelect() {
    let rows = (this.store[this.table] || []).filter(r => this.filters.every(f => f(r)))
    if (this.sort) {
      const { col, ascending } = this.sort
      rows = [...rows].sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (ascending ? 1 : -1))
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN)
    rows = rows.map(r => applyEmbeds(r, this.selectStr, this.store))
    if (this.wantSingle) {
      return rows[0]
        ? { data: rows[0], error: null }
        : { data: null, error: { message: 'No rows found', code: 'PGRST116' } }
    }
    if (this.wantMaybeSingle) return { data: rows[0] ?? null, error: null }
    return { data: rows, error: null }
  }

  private runMutation() {
    // Every write action Explore Mode supports is intentionally locked —
    // see the LOCKED ACTIONS list in EXPLORE_MODE_REPORT.md. Trigger the
    // premium bottom sheet, then return a graceful (non-throwing-shaped,
    // but still `error`-populated) result so the existing
    // `if (error) throw error` pattern in queries.ts propagates it
    // exactly like any other Postgrest error would.
    requestExploreLock()
    return {
      data: this.wantSingle || this.wantMaybeSingle ? null : [],
      error: { message: "You're exploring Rentivo — create a free account to save changes.", code: 'EXPLORE_LOCKED' },
    }
  }

  then(resolve: (v: { data: any; error: any }) => void, reject?: (e: any) => void) {
    try {
      const result = this.mode === 'select' ? this.runSelect() : this.runMutation()
      resolve(result)
    } catch (e) {
      if (reject) reject(e)
    }
  }
}

export function createMockPostgrestClient(store: Store) {
  return {
    from(table: string) {
      return new MockQueryBuilder(table, store)
    },
    rpc(fnName: string, _args?: Record<string, any>) {
      if (READ_ONLY_RPCS.has(fnName)) {
        return Promise.resolve({ data: [], error: null })
      }
      requestExploreLock()
      return Promise.resolve({
        data: null,
        error: { message: "You're exploring Rentivo — create a free account to do this.", code: 'EXPLORE_LOCKED' },
      })
    },
  }
}
