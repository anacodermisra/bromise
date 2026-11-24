import React, { useMemo, useState } from 'react';
import {
  Database,
  Search,
  RefreshCw,
  Copy,
  Check,
  Download,
  HardDrive,
  Cloud,
} from 'lucide-react';
import { getActiveUserId, getKey } from '../../utils/storage';
import { api } from '../../services/api';
import type {
  Category,
  Task,
  DailyPlanItem,
  TaskCompletion,
  GymSchedule,
  StudyBook,
} from '../../types';

type TabId = 'tasks' | 'categories' | 'plans' | 'completions' | 'gym' | 'study' | 'raw';

interface Snapshot {
  categories: Category[];
  tasks: Task[];
  plans: DailyPlanItem[];
  completions: TaskCompletion[];
  gym: GymSchedule | null;
  study: StudyBook[];
  keys: Record<string, string>;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'tasks', label: 'Tasks' },
  { id: 'categories', label: 'Categories' },
  { id: 'plans', label: 'Daily Plans' },
  { id: 'completions', label: 'Completions' },
  { id: 'gym', label: 'Gym' },
  { id: 'study', label: 'Study' },
  { id: 'raw', label: 'Raw Storage' },
];

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function buildSnapshot(): Snapshot {
  const keys: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith('bromise_')) {
      keys[k] = localStorage.getItem(k) ?? '';
    }
  }
  return {
    categories: readJSON<Category[]>(getKey('categories'), []),
    tasks: readJSON<Task[]>(getKey('tasks'), []),
    plans: readJSON<DailyPlanItem[]>(getKey('daily_plans'), []),
    completions: readJSON<TaskCompletion[]>(getKey('completions'), []),
    gym: readJSON<GymSchedule | null>(getKey('gym_schedule'), null),
    study: readJSON<StudyBook[]>(getKey('study_books'), []),
    keys,
  };
}

const fmtDate = (value?: string | null) => (value ? value.slice(0, 10) : '—');

export const DatabaseViewer: React.FC = () => {
  const [localSnapshot, setSnapshot] = useState<Snapshot>(() => buildSnapshot());
  const [source, setSource] = useState<'local' | 'server'>('local');
  const [serverData, setServerData] = useState<any>(null);
  const [loadingServer, setLoadingServer] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>('tasks');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState(false);

  const userId = getActiveUserId();
  const scope = userId ? `User: ${userId}` : 'Guest (local demo)';

  const snapshot: Snapshot = source === 'server' && serverData
    ? {
        categories: serverData.categories ?? [],
        tasks: serverData.tasks ?? [],
        plans: serverData.dailyPlans ?? [],
        completions: serverData.completions ?? [],
        gym: serverData.gymSchedule ?? null,
        study: serverData.studyBooks ?? [],
        keys: { '/api/export (Turso server DB)': JSON.stringify(serverData) },
      }
    : localSnapshot;

  const refresh = () => setSnapshot(buildSnapshot());
  const orphanTasks = snapshot.tasks.filter(
    t => !t.archivedAt && !snapshot.categories.some(c => c.id === t.categoryId)
  );

  const loadServer = async () => {
    setLoadingServer(true);
    setSourceError(null);
    try {
      const data = await api.exportData();
      if (!data || data.error) throw new Error(data?.error || 'Server returned no data');
      setServerData(data);
      setSource('server');
    } catch (e: any) {
      setSourceError(`Could not read server DB: ${e?.message ?? 'unknown error'}`);
    } finally {
      setLoadingServer(false);
    }
  };

  const counts: Record<TabId, number> = {
    tasks: localSnapshot.tasks.length,
    categories: localSnapshot.categories.length,
    plans: localSnapshot.plans.length,
    completions: localSnapshot.completions.length,
    gym: localSnapshot.gym ? Object.keys(localSnapshot.gym).length : 0,
    study: localSnapshot.study.length,
    raw: Object.keys(localSnapshot.keys).length,
  };

  const q = query.trim().toLowerCase();
  const matches = (...values: (string | undefined | null)[]) =>
    !q || values.some(v => (v ?? '').toLowerCase().includes(q));

  const catName = (id: string) =>
    localSnapshot.categories.find(c => c.id === id)?.name ?? id;

  const taskDates = (taskId: string) =>
    localSnapshot.plans.filter(p => p.taskId === taskId).map(p => p.date).sort();

  const rows: any[] = useMemo(() => {
    switch (tab) {
      case 'tasks':
        return localSnapshot.tasks.filter(t =>
          matches(t.title, t.notes, catName(t.categoryId), t.id, t.archivedAt ?? '')
        );
      case 'categories':
        return localSnapshot.categories.filter(c => matches(c.name, c.id, c.icon));
      case 'plans':
        return localSnapshot.plans.filter(p =>
          matches(p.date, p.taskId, localSnapshot.tasks.find(t => t.id === p.taskId)?.title)
        );
      case 'completions':
        return localSnapshot.completions.filter(c =>
          matches(c.date, c.taskId, localSnapshot.tasks.find(t => t.id === c.taskId)?.title)
        );
      case 'study':
        return localSnapshot.study.filter(b => matches(b.title, b.id, b.notes));
      default:
        return [];
    }
  }, [tab, localSnapshot, query]);

  const rawText = useMemo(
    () => JSON.stringify(
      tab === 'raw'
        ? localSnapshot.keys
        : {
            scope,
            categories: localSnapshot.categories,
            tasks: localSnapshot.tasks,
            daily_plans: localSnapshot.plans,
            completions: localSnapshot.completions,
            gym_schedule: localSnapshot.gym,
            study_books: localSnapshot.study,
          },
      null,
      2
    ),
    [tab, localSnapshot, scope]
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([rawText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bromise-db-${tab}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 rounded-3xl bg-dark-900 border border-dark-800 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-theme-title font-sans">Database Viewer</h3>
            <p className="text-xs text-dark-400 mt-0.5">
              The exact records stored in this browser. Nothing hidden, nothing summarised.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSource('local')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
              source === 'local'
                ? 'bg-theme-accent/15 text-theme-accent border-theme-accent/30'
                : 'bg-dark-950 text-dark-400 border-dark-800'
            }`}
          >
            Local browser
          </button>
          <button
            type="button"
            onClick={loadServer}
            disabled={loadingServer}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all disabled:opacity-50 ${
              source === 'server'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-dark-950 text-dark-400 border-dark-800'
            }`}
          >
            {loadingServer ? 'Loading…' : 'Server DB (Turso)'}
          </button>
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-dark-950 border border-dark-800 text-[11px] font-mono text-dark-300">
            {source === 'server' ? <Cloud className="w-3 h-3 text-emerald-400" /> : <HardDrive className="w-3 h-3 text-emerald-400" />}
            <span>{source === 'server' ? serverData?.exportedAt ? `Exported ${serverData.exportedAt.slice(0, 16)}` : 'Turso server' : scope}</span>
          </span>
          <button
            type="button"
            onClick={refresh}
            className="p-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-theme-title border border-dark-700 transition-all"
            title="Refresh from storage"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
              tab === t.id
                ? 'bg-theme-accent/15 text-theme-accent border-theme-accent/30'
                : 'bg-dark-950 text-dark-400 border-dark-800 hover:text-theme-title'
            }`}
          >
            {t.label} <span className="opacity-60">({counts[t.id]})</span>
          </button>
        ))}
      </div>

      {sourceError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-semibold">
          {sourceError}
        </div>
      )}

      {orphanTasks.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] leading-relaxed">
          <b>{orphanTasks.length} active task(s) have a deleted/missing category.</b> They are marked
          “(category deleted)” and can still be found by name. Examples: {orphanTasks.slice(0, 4).map(t => t.title).join(', ')}.
        </div>
      )}

      {tab !== 'raw' && tab !== 'gym' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search titles, ids, dates, categories…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-dark-950 border border-dark-800 text-xs text-theme-title placeholder:text-dark-600 focus:outline-none focus:border-theme-accent/50"
          />
        </div>
      )}

      <div className="rounded-2xl bg-dark-950 border border-dark-800 overflow-hidden">
        {tab === 'tasks' && (
          <div className="divide-y divide-dark-800 max-h-96 overflow-y-auto">
            {rows.map((t: Task) => {
              const dates = taskDates(t.id);
              return (
                <div key={t.id} className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`text-xs font-bold truncate ${t.archivedAt ? 'text-dark-500 line-through' : 'text-theme-title'}`}>
                        {t.title}
                      </div>
                      <div className="text-[10px] text-dark-500 font-mono truncate">{t.id}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-theme-accent/10 border border-theme-accent/20 text-theme-accent text-[10px] font-bold whitespace-nowrap">
                      {catName(t.categoryId)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-dark-400">
                    <span>Priority: <b className="text-dark-300">{t.priority}</b></span>
                    <span>Created: <b className="text-dark-300">{fmtDate(t.createdAt)}</b></span>
                    <span>Scheduled: <b className="text-dark-300">{dates.length ? dates.join(', ') : 'never'}</b></span>
                    {t.archivedAt && <span className="text-rose-400">Archived {fmtDate(t.archivedAt)}</span>}
                  </div>
                  {t.notes && <div className="text-[10px] text-dark-500 italic">{t.notes}</div>}
                </div>
              );
            })}
            {rows.length === 0 && <div className="p-6 text-center text-xs text-dark-500">No tasks found.</div>}
          </div>
        )}

        {tab === 'categories' && (
          <div className="divide-y divide-dark-800 max-h-96 overflow-y-auto">
            {rows.map((c: Category) => (
              <div key={c.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-theme-title">{c.name}</div>
                  <div className="text-[10px] text-dark-500 font-mono">{c.id}</div>
                </div>
                <div className="text-[10px] text-dark-400">
                  Tasks: <b className="text-theme-accent">{localSnapshot.tasks.filter(t => t.categoryId === c.id).length}</b>
                  {c.archivedAt && <span className="ml-2 text-rose-400">archived</span>}
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="p-6 text-center text-xs text-dark-500">No categories found.</div>}
          </div>
        )}

        {tab === 'plans' && (
          <div className="divide-y divide-dark-800 max-h-96 overflow-y-auto">
            {rows.map((p: DailyPlanItem) => (
              <div key={p.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-theme-title">
                    {localSnapshot.tasks.find(t => t.id === p.taskId)?.title ?? p.taskId}
                  </div>
                  <div className="text-[10px] text-dark-500 font-mono">{p.id}</div>
                </div>
                <div className="text-right text-[10px] text-dark-400 space-y-0.5">
                  <div><b className="text-emerald-400">{p.date}</b></div>
                  <div>{p.startTime ?? p.timeSlot ?? 'no time'} · {p.sourceType}{p.completed ? ' · done' : ''}</div>
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="p-6 text-center text-xs text-dark-500">No daily plans found.</div>}
          </div>
        )}

        {tab === 'completions' && (
          <div className="divide-y divide-dark-800 max-h-96 overflow-y-auto">
            {rows.map((c: TaskCompletion) => (
              <div key={c.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-theme-title">
                    {localSnapshot.tasks.find(t => t.id === c.taskId)?.title ?? c.taskId}
                  </div>
                  <div className="text-[10px] text-dark-500 font-mono">{fmtDate(c.completedAt)}</div>
                </div>
                <div className="text-[10px] text-dark-400">
                  <b className={c.completed ? 'text-emerald-400' : 'text-dark-400'}>{c.date}</b>
                  {' · '}{c.completed ? 'completed' : 'unmarked'}
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="p-6 text-center text-xs text-dark-500">No completion records found.</div>}
          </div>
        )}

        {tab === 'gym' && (
          <div className="divide-y divide-dark-800 max-h-96 overflow-y-auto">
            {Object.values(localSnapshot.gym ?? {}).map(day => (
              <div key={day.id} className="p-3">
                <div className="text-xs font-bold text-theme-title">{day.dayName} — {day.title}</div>
                <div className="text-[10px] text-dark-400 mt-1">
                  {day.restDay ? 'Rest day' : `${day.exercises?.length ?? 0} exercises`}
                </div>
              </div>
            ))}
            {!localSnapshot.gym && <div className="p-6 text-center text-xs text-dark-500">No gym schedule stored.</div>}
          </div>
        )}

        {tab === 'study' && (
          <div className="divide-y divide-dark-800 max-h-96 overflow-y-auto">
            {rows.map((b: StudyBook) => (
              <div key={b.id} className="p-3">
                <div className="text-xs font-bold text-theme-title">{b.title}</div>
                <div className="text-[10px] text-dark-400 mt-1">
                  {b.chapters?.length ?? 0} chapters · {b.id}
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="p-6 text-center text-xs text-dark-500">No study books stored.</div>}
          </div>
        )}

        {tab === 'raw' && (
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            <div className="text-[11px] text-dark-400">
              Every <code className="text-theme-accent">bromise_</code> key in this browser. This is the raw local source of truth.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(localSnapshot.keys).map(([key, value]) => (
                <div key={key} className="p-2 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] font-mono text-theme-accent break-all">{key}</div>
                  <div className="text-[10px] text-dark-500 mt-0.5">{value.length.toLocaleString()} chars</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[10px] text-dark-500 max-w-md">
          Storage is per-browser and per-account. If a task exists in the cloud app but not here, sign in with the same Google account and let sync pull it down.
        </p>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={copy}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-theme-title border border-dark-700 text-[11px] font-bold transition-all"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>
          <button
            type="button"
            onClick={download}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-theme-accent/15 hover:bg-theme-accent/25 text-theme-accent border border-theme-accent/30 text-[11px] font-bold transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};
