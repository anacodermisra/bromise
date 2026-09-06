export interface DeadlineStatus {
  text: string;
  isOverdue: boolean;
  isDueToday: boolean;
  colorClass: string;
}

export function getDeadlineStatus(deadlineStr?: string | null): DeadlineStatus | null {
  if (!deadlineStr) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date(todayStr);
  const target = new Date(deadlineStr);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const daysAgo = Math.abs(diffDays);
    return {
      text: `Overdue (${daysAgo}d ago)`,
      isOverdue: true,
      isDueToday: false,
      colorClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse',
    };
  }

  if (diffDays === 0) {
    return {
      text: 'Due Today',
      isOverdue: false,
      isDueToday: true,
      colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    };
  }

  if (diffDays === 1) {
    return {
      text: 'Due Tomorrow',
      isOverdue: false,
      isDueToday: false,
      colorClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    };
  }

  return {
    text: `Due ${deadlineStr}`,
    isOverdue: false,
    isDueToday: false,
    colorClass: 'bg-dark-800 text-dark-400 border-dark-750',
  };
}
