export interface Quote {
  /** 在原文里的序号，当作稳定 key */
  i: number
  /** 'YYYY-MM-DD HH:mm:ss'，本地时间，原样保留 */
  time: string
  /** 当天 00:00 的时间戳，给日期筛选用 */
  day: number
  text: string
}

const HEAD = /^\[(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}:\d{2})\] [^:]+: ?(.*)$/

/**
 * 解析 QQ 群聊导出：每条消息以 `[时间] 昵称: ` 开头；
 * 不以它开头的行（空行、长消息的后续段落）并回上一条消息。
 * 文件头（统计信息和分隔线）出现在第一条消息之前，自然被跳过。
 */
export function parseQuotes(raw: string): Quote[] {
  const out: Quote[] = []
  for (const line of raw.split(/\r?\n/)) {
    const m = HEAD.exec(line)
    if (m) {
      const [, y, mo, d, hms, text] = m
      out.push({
        i: out.length,
        time: `${y}-${mo}-${d} ${hms}`,
        day: new Date(+y, +mo - 1, +d).getTime(),
        text,
      })
    } else if (out.length) {
      out[out.length - 1].text += '\n' + line
    }
  }
  for (const q of out) q.text = q.text.trimEnd()
  return out
}
