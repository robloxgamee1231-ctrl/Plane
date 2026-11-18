import { assetUrl } from '../hosting';
import {
  useEffect,
  useRef,
  useId,
  isValidElement,
  cloneElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  X,
  ArrowUpRight,
  Check,
  ChevronRight,
  SlidersHorizontal,
  Plane,
  Map,
  Clapperboard,
  LayoutDashboard,
  Settings2,
  BookOpen,
} from 'lucide-react';
export const pages = [
  { id: 'deck', label: 'Flight Deck', icon: LayoutDashboard, group: 'WORKSPACE' },
  { id: 'aircraft', label: 'Aircraft Hangar', icon: Plane, group: 'WORKSPACE', count: '07' },
  { id: 'maps', label: 'Environments', icon: Map, group: 'WORKSPACE', count: '06' },
  { id: 'scenarios', label: 'Scenario Lab', icon: SlidersHorizontal, group: 'WORKSPACE' },
  { id: 'replays', label: 'Flight Replays', icon: Clapperboard, group: 'LIBRARY' },
  { id: 'settings', label: 'Settings', icon: Settings2, group: 'SYSTEM' },
  { id: 'manual', label: 'Flight Manual', icon: BookOpen, group: 'SYSTEM' },
];
export function Brand() {
  return (
    <div className="brand">
      <img src={assetUrl('ndx.svg')} alt="" />
      <div>
        <div className="wordmark">NDX</div>
        <div className="brand-sub">FLIGHT DISASTER</div>
      </div>
    </div>
  );
}
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="eyebrow">
      <span className="edge-marks" />
      {children}
    </div>
  );
}
export function PageTitle({
  tag,
  title,
  desc,
  action,
}: {
  tag: string;
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <Eyebrow>{tag}</Eyebrow>
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      {action && <div className="title-action">{action}</div>}
    </div>
  );
}
export function Modal({
  title,
  kicker,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    closer = useRef(onClose);
  closer.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const root = ref.current!;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focus = () =>
      root
        .querySelector<HTMLElement>('[autofocus],button,input,select,textarea,[tabindex="0"]')
        ?.focus();
    focus();
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        closer.current();
      }
      if (e.key === 'Tab') {
        const els = [
          ...root.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,textarea,[tabindex="0"]',
          ),
        ].filter((e) => e.offsetParent !== null);
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    window.addEventListener('keydown', fn, true);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', fn, true);
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={'modal ' + (wide ? 'wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div>
            {kicker && <Eyebrow>{kicker}</Eyebrow>}
            <h2>{title}</h2>
          </div>
          <button className="iconbtn" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Tag({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span className={'tag ' + (active ? 'selected' : '')}>
      {active && <Check size={11} />} {children}
    </span>
  );
}
export function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      className={'toggle ' + (value ? 'on' : '')}
      aria-label={label}
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
    >
      <i />
    </button>
  );
}
export function Field({ label, children, help }: { label: string; children: ReactNode; help?: string }) {
  const id = useId();
  const direct =
    isValidElement(children) &&
    typeof children.type === 'string' &&
    ['input', 'select', 'textarea'].includes(children.type);
  return (
    <div className="field">
      {direct ? <label htmlFor={id}>{label}</label> : <span id={id + '-label'}>{label}</span>}
      {direct ? (
        cloneElement(children as ReactElement<{ id: string; 'aria-describedby'?: string }>, {
          id,
          'aria-describedby': help ? id + '-help' : undefined,
        })
      ) : (
        <div role="group" aria-labelledby={id + '-label'}>
          {children}
        </div>
      )}
      {help && <small id={id + '-help'}>{help}</small>}
    </div>
  );
}
export function Empty({
  icon,
  title,
  desc,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{desc}</p>
      {action && (
        <button className="btn dark" onClick={onClick}>
          {action}
          <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}
export function RowLink({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button className="row-link" onClick={onClick}>
      {icon}
      <span>
        <b>{title}</b>
        <small>{desc}</small>
      </span>
      <ChevronRight size={16} />
    </button>
  );
}
export function Key({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}
