import { useMemo } from 'react'
import { plural } from '../../../utils/plural'
import { buildCalendar, type DailyActivity } from '../utils/goalProgress'

const WEEKDAY_LABELS = ['Pn', '', 'Śr', '', 'Pt', '', '']
const MONTHS = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']

function cellClass(count: number, isFuture: boolean): string {
  if (isFuture) return 'bg-transparent'
  if (count === 0) return 'bg-paper-dim'
  if (count === 1) return 'bg-accent/45'
  if (count <= 3) return 'bg-accent/75'
  return 'bg-accent'
}

function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return `${date} ${MONTHS[month - 1]} ${year}`
}

function describe(count: number): string {
  if (count === 0) return 'brak rysunków'
  return `${count} ${plural(count, 'rysunek', 'rysunki', 'rysunków')}`
}

export function ActivityCalendar({ activity, today, weeks = 26 }: { activity: DailyActivity[]; today: string; weeks?: number }) {
  const calendar = useMemo(() => buildCalendar(activity, today, weeks), [activity, today, weeks])

  // Etykieta miesiąca nad tygodniem, w którym zaczyna się nowy miesiąc.
  const monthLabels = calendar.map((week, index) => {
    const month = Number(week[0].day.slice(5, 7))
    const previousMonth = index > 0 ? Number(calendar[index - 1][0].day.slice(5, 7)) : null
    return month !== previousMonth ? MONTHS[month - 1] : ''
  })

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid grid-flow-col gap-[3px] [grid-template-rows:auto_repeat(7,12px)]">
        <span />
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={index} className="pr-2 text-[10px] leading-[12px] text-ink-faint">
            {label}
          </span>
        ))}

        {calendar.map((week, weekIndex) => [
          <span key={`m-${weekIndex}`} className="h-4 w-3 overflow-visible whitespace-nowrap text-[10px] text-ink-faint">
            {monthLabels[weekIndex]}
          </span>,
          ...week.map((cell) => (
            <span
              key={cell.day}
              title={cell.isFuture ? undefined : `${formatDay(cell.day)}: ${describe(cell.count)}`}
              className={[
                'h-3 w-3 rounded-[3px]',
                cellClass(cell.count, cell.isFuture),
                cell.isToday ? 'ring-[1.5px] ring-inset ring-ink' : '',
              ].join(' ')}
            />
          )),
        ])}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-faint">
        mniej
        {[0, 1, 2, 4].map((count) => (
          <span key={count} className={`h-3 w-3 rounded-[3px] ${cellClass(count, false)}`} />
        ))}
        więcej
      </div>
    </div>
  )
}
