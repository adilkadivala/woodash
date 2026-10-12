import { formatDistanceToNow, parseISO } from "date-fns"

export function RelativeTime({
  date,
  className,
}: {
  date?: string | null
  className?: string
}) {
  if (!date) return <span className="text-muted-foreground">—</span>

  try {
    const parsed = typeof date === "string" ? parseISO(date) : new Date(date)
    const relative = formatDistanceToNow(parsed, { addSuffix: true })
    const full = parsed.toLocaleString()

    return (
      <span title={full} className={className}>
        {relative}
      </span>
    )
  } catch {
    return <span className={className}>{date}</span>
  }
}
