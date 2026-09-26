import raw from './data.txt?raw'
import { parseQuotes } from './parse'

export const all = parseQuotes(raw)

export interface Month {
  key: string
  count: number
  from: number
  to: number
}

/** 每个自然月的消息数与日期范围（当天 00:00 时间戳），按时间升序 */
export const months: Month[] = (() => {
  const map = new Map<string, Month>()
  for (const q of all) {
    const key = q.time.slice(0, 7)
    let m = map.get(key)
    if (!m) {
      const [y, mo] = key.split('-').map(Number)
      m = { key, count: 0, from: new Date(y, mo - 1, 1).getTime(), to: new Date(y, mo, 0).getTime() }
      map.set(key, m)
    }
    m.count++
  }
  return [...map.values()]
})()
