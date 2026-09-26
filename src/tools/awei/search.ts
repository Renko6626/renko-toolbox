/**
 * 查询语法（都可以混用，空格分隔）：
 *   词 词      同时包含
 *   a|b        包含 a 或 b
 *   -词        不包含
 *   /正则/     整个查询是一条正则（不区分大小写）
 * 匹配前两边都做 NFKC + 小写，所以全角半角、大小写不敏感（「？」能搜到「?」）。
 */

export function norm(s: string): string {
  return s.normalize('NFKC').toLowerCase()
}

export interface Query {
  /** 每项是一组 OR 备选，组与组之间 AND */
  all: string[][]
  none: string[]
  regex: RegExp | null
  /** 正则写错时的提示；为 null 表示查询合法 */
  error: string | null
  /** 用于高亮的正则；空查询为 null */
  highlight: RegExp | null
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function parseQuery(input: string): Query {
  const q: Query = { all: [], none: [], regex: null, error: null, highlight: null }
  const raw = input.trim()
  const re = /^\/(.+)\/$/.exec(raw)
  if (re) {
    try {
      q.regex = new RegExp(re[1], 'i')
      q.highlight = new RegExp(re[1], 'gi')
    } catch (e) {
      q.error = `正则写错了：${(e as Error).message}`
    }
    return q
  }
  for (const tok of norm(raw).split(/\s+/).filter(Boolean)) {
    if (tok.startsWith('-') && tok.length > 1) q.none.push(tok.slice(1))
    else {
      const alts = tok.split('|').filter(Boolean)
      if (alts.length) q.all.push(alts)
    }
  }
  const hl = q.all.flat()
  if (hl.length) {
    // 长的放前面，避免「苹果」先吃掉「苹果派」的前半截
    hl.sort((a, b) => b.length - a.length)
    q.highlight = new RegExp(hl.map(esc).join('|'), 'gi')
  }
  return q
}

export function matches(q: Query, text: string, normed: string): boolean {
  if (q.error) return false
  if (q.regex) return q.regex.test(text)
  return (
    q.all.every((alts) => alts.some((a) => normed.includes(a))) &&
    !q.none.some((n) => normed.includes(n))
  )
}

/**
 * 按 highlight 切出命中片段。高亮在原文上做，所以 NFKC 折叠过的
 * 全角字符不会被标出来——筛选对，只是少一层高亮，可以接受。
 */
export function pieces(text: string, hl: RegExp | null): { s: string; hit: boolean }[] {
  if (!hl) return [{ s: text, hit: false }]
  const out: { s: string; hit: boolean }[] = []
  let last = 0
  hl.lastIndex = 0
  for (const m of text.matchAll(hl)) {
    if (!m[0]) continue
    const i = m.index!
    if (i > last) out.push({ s: text.slice(last, i), hit: false })
    out.push({ s: m[0], hit: true })
    last = i + m[0].length
  }
  if (last < text.length) out.push({ s: text.slice(last), hit: false })
  return out.length ? out : [{ s: text, hit: false }]
}
