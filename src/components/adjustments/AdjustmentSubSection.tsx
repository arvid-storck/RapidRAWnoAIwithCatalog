import { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { withAdjustmentLayout } from '../../utils/adjustments';

interface Props {
  actions?: ReactNode;
  children: ReactNode;
  id: string;
  order: number;
  title: string;
}

export default function AdjustmentSubSection({ actions, children, id, order, title }: Props) {
  const settings = useSettingsStore((s) => s.appSettings);
  const save = useSettingsStore((s) => s.handleSettingsChange);
  const collapsed = settings?.adjustmentLayout?.collapsedTools ?? [];
  const isCollapsed = collapsed.includes(id);
  return (
    <div className="p-2 bg-bg-tertiary rounded-md" style={{ order }}>
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-2 grow text-left font-medium"
          aria-expanded={!isCollapsed}
          onClick={() =>
            settings &&
            void save(
              withAdjustmentLayout(settings, {
                collapsedTools: isCollapsed ? collapsed.filter((tool) => tool !== id) : [...collapsed, id],
              }),
            )
          }
        >
          <span className="grow">{title}</span>
          <ChevronDown size={16} className={isCollapsed ? '' : 'rotate-180'} />
        </button>
        {actions}
      </div>
      <div className={isCollapsed ? 'hidden' : 'pt-2'}>{children}</div>
    </div>
  );
}
