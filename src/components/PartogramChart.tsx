import { formatClock, formatDayMonth } from '../calc';
import { LENGTH_LABELS, type Analysis } from '../partogram';

const W = 340;
const LEFT = 28;
const RIGHT = 12;
const TOP = 10;
const PLOT_H = 150;
const STRIP_TOP = TOP + PLOT_H + 18;
const STRIP_H = 36;
const H = STRIP_TOP + STRIP_H + 22;
const MAX_CONTRACTIONS = 6;

interface Props {
  analysis: Analysis;
  waters: number | null;
  oxytocin: number | null;
}

export function PartogramChart({ analysis, waters, oxytocin }: Props) {
  const { points } = analysis;
  if (points.length === 0) {
    return <div className="scale-off">График появится после первого осмотра.</div>;
  }

  const first = points[0].at;
  const last = points[points.length - 1].at;
  const t0 = Math.floor(first / 60) * 60;
  const t1 = Math.max(Math.ceil(last / 60) * 60, t0 + 4 * 60);
  const span = t1 - t0;
  const stepH = span <= 8 * 60 ? 1 : span <= 16 * 60 ? 2 : span <= 32 * 60 ? 4 : 6;

  const x = (t: number) => LEFT + ((t - t0) / span) * (W - LEFT - RIGHT);
  const y = (cm: number) => TOP + ((10 - cm) / 10) * PLOT_H;
  const inRange = (t: number | null): t is number => t !== null && t >= t0 && t <= t1;

  const ticks: number[] = [];
  for (let t = t0; t <= t1; t += stepH * 60) ticks.push(t);

  const dil = points.filter((p) => p.dilation !== null);
  const heads = points.filter((p) => p.head !== null);
  const counts = points.filter((p) => p.contractions !== null);
  const line = (list: typeof points, v: (p: (typeof points)[number]) => number) =>
    list.map((p) => `${x(p.at).toFixed(1)},${y(v(p)).toFixed(1)}`).join(' ');

  const description = [
    'Партограмма.',
    dil.length
      ? `Раскрытие: ${dil.map((p) => `${p.dilation} см в ${formatClock(p.at)}`).join(', ')}.`
      : 'Раскрытие не отмечено.',
    heads.length ? `Головка: ${heads.map((p) => `${p.head}/5 в ${formatClock(p.at)}`).join(', ')}.` : '',
    counts.length
      ? `Схватки: ${counts
          .map((p) => `${p.contractions} за 10 мин${p.length ? ` (${LENGTH_LABELS[p.length]})` : ''} в ${formatClock(p.at)}`)
          .join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <figure className="pg" aria-label={description}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true" focusable="false">
        {/* сетка раскрытия */}
        {[0, 2, 4, 6, 8, 10].map((cm) => (
          <g key={cm}>
            <line className="pg-grid" x1={LEFT} x2={W - RIGHT} y1={y(cm)} y2={y(cm)} />
            <text className="pg-ylab" x={LEFT - 6} y={y(cm) + 4} textAnchor="end">
              {cm}
            </text>
          </g>
        ))}
        <line className="pg-active" x1={LEFT} x2={W - RIGHT} y1={y(5)} y2={y(5)} />
        <text className="pg-note" x={W - RIGHT - 2} y={y(5) - 4} textAnchor="end">
          активная фаза
        </text>
        {ticks.map((t) => (
          <g key={t}>
            <line className="pg-grid" x1={x(t)} x2={x(t)} y1={TOP} y2={STRIP_TOP + STRIP_H} />
            <text className="pg-xlab" x={x(t)} y={H - 6} textAnchor="middle">
              {formatClock(t)}
            </text>
          </g>
        ))}

        {/* события */}
        {inRange(waters) && (
          <g>
            <line className="pg-waters" x1={x(waters)} x2={x(waters)} y1={TOP} y2={TOP + PLOT_H} />
            <text className="pg-note water" x={x(waters) + 3} y={TOP + PLOT_H - 4}>
              воды
            </text>
          </g>
        )}
        {inRange(oxytocin) && (
          <g>
            <line className="pg-oxy" x1={x(oxytocin)} x2={x(oxytocin)} y1={TOP} y2={TOP + PLOT_H} />
            <text className="pg-note oxy" x={x(oxytocin) + 3} y={TOP + 10}>
              окситоцин
            </text>
          </g>
        )}

        {/* головка: пятые над лоном */}
        {heads.length > 1 && <polyline className="pg-head-line" points={line(heads, (p) => p.head as number)} />}
        {heads.map((p) => (
          <circle key={`h${p.id}`} className="pg-head" cx={x(p.at)} cy={y(p.head as number)} r={4.5} />
        ))}

        {/* раскрытие */}
        {dil.length > 1 && <polyline className="pg-dil-line" points={line(dil, (p) => p.dilation as number)} />}
        {dil.map((p) => (
          <circle key={`d${p.id}`} className="pg-dil" cx={x(p.at)} cy={y(p.dilation as number)} r={4.5} />
        ))}

        {/* схватки за 10 минут */}
        <text className="pg-ylab" x={LEFT - 6} y={STRIP_TOP + 10} textAnchor="end">
          сх.
        </text>
        <line className="pg-axis" x1={LEFT} x2={W - RIGHT} y1={STRIP_TOP + STRIP_H} y2={STRIP_TOP + STRIP_H} />
        {counts.map((p) => {
          const n = p.contractions as number;
          const h = (Math.min(n, MAX_CONTRACTIONS) / MAX_CONTRACTIONS) * STRIP_H;
          const cls = p.length === 'lt20' ? 'pg-bar weak' : p.length === '20to40' ? 'pg-bar mid' : 'pg-bar';
          return (
            <g key={`c${p.id}`}>
              <rect className={cls} x={x(p.at) - 4} y={STRIP_TOP + STRIP_H - h} width={8} height={Math.max(h, 1)} rx={2} />
              <text className="pg-count" x={x(p.at)} y={STRIP_TOP + STRIP_H - h - 3} textAnchor="middle">
                {n}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="pg-legend">
        <span>
          <i className="lg-dil" />
          раскрытие, см
        </span>
        <span>
          <i className="lg-head" />
          головка, пятые над лоном
        </span>
        <span>
          <i className="lg-bar" />
          схватки за 10 мин
        </span>
        <span className="pg-from">с {formatDayMonth(t0)}</span>
      </figcaption>
    </figure>
  );
}
