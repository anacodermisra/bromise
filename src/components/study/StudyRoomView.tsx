import React, { useState, useEffect } from 'react';
import type { StudyBook, StudyChapter } from '../../types';
import { getStudyBooks, saveStudyBooks } from '../../utils/storage';
import { STUDY_SHELVES } from '../../utils/studyData';
import confetti from 'canvas-confetti';
import {
  BookOpen,
  GraduationCap,
  Bookmark,
  Plus,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Clock,
  ArrowRight,
  Trash2,
  FileText,
  X,
  Headphones,
} from 'lucide-react';

interface StudyRoomViewProps {
  onPushToToday?: (taskTitle: string, notes?: string) => void;
}

export const StudyRoomView: React.FC<StudyRoomViewProps> = ({ onPushToToday }) => {
  const [books, setBooks] = useState<StudyBook[]>(getStudyBooks());
  const [selectedBook, setSelectedBook] = useState<StudyBook | null>(null);
  const [activeShelfId, setActiveShelfId] = useState<string>('courses');

  // New Book / Course Modal
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCategory, setNewCategory] = useState('Computer Science');
  const [newShelf, setNewShelf] = useState<string>('courses');
  const [newColor, setNewColor] = useState('#38bdf8');
  const [newNotes, setNewNotes] = useState('');

  // New Chapter Form
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterMinutes, setNewChapterMinutes] = useState(45);

  // Pomodoro Focus Timer State
  const [pomodoroMinutes, setPomodoroMinutes] = useState(25);
  const [pomodoroRemaining, setPomodoroRemaining] = useState(25 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Web Audio Synth for Ambient Sound (Zero network required)
  const [ambientSound, setAmbientSound] = useState<'off' | 'binaural' | 'rain' | 'brown'>('off');
  const [audioNodes, setAudioNodes] = useState<{ ctx: AudioContext; stop: () => void } | null>(null);

  useEffect(() => {
    const handleStudyChange = () => setBooks(getStudyBooks());
    window.addEventListener('bromise-study-change', handleStudyChange);
    return () => window.removeEventListener('bromise-study-change', handleStudyChange);
  }, []);

  // Pomodoro timer tick
  useEffect(() => {
    let interval: any = null;
    if (isTimerActive && pomodoroRemaining > 0) {
      interval = setInterval(() => {
        setPomodoroRemaining(prev => {
          if (prev <= 1) {
            setIsTimerActive(false);
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.6 },
              colors: ['#38bdf8', '#8b5cf6', '#f59e0b'],
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, pomodoroRemaining]);

  // Ambient sound synthesizer using Web Audio API
  const handleToggleAmbient = (type: 'binaural' | 'rain' | 'brown') => {
    if (ambientSound === type) {
      if (audioNodes) {
        audioNodes.stop();
        audioNodes.ctx.close();
        setAudioNodes(null);
      }
      setAmbientSound('off');
      return;
    }

    if (audioNodes) {
      audioNodes.stop();
      audioNodes.ctx.close();
      setAudioNodes(null);
    }

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.connect(ctx.destination);

      if (type === 'binaural') {
        const merger = ctx.createChannelMerger(2);
        const oscL = ctx.createOscillator();
        const oscR = ctx.createOscillator();
        oscL.frequency.setValueAtTime(200, ctx.currentTime);
        oscR.frequency.setValueAtTime(210, ctx.currentTime);
        oscL.connect(merger, 0, 0);
        oscR.connect(merger, 0, 1);
        merger.connect(gain);
        oscL.start();
        oscR.start();

        setAudioNodes({
          ctx,
          stop: () => {
            try {
              oscL.stop();
              oscR.stop();
            } catch {}
          },
        });
      } else if (type === 'rain') {
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(gain);
        whiteNoise.start();

        setAudioNodes({
          ctx,
          stop: () => {
            try {
              whiteNoise.stop();
            } catch {}
          },
        });
      } else if (type === 'brown') {
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 4.0;
        }

        const brownNoise = ctx.createBufferSource();
        brownNoise.buffer = noiseBuffer;
        brownNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, ctx.currentTime);

        brownNoise.connect(filter);
        filter.connect(gain);
        brownNoise.start();

        setAudioNodes({
          ctx,
          stop: () => {
            try {
              brownNoise.stop();
            } catch {}
          },
        });
      }

      setAmbientSound(type);
    } catch (e) {
      console.error('Failed to start ambient audio:', e);
    }
  };

  // Toggle chapter complete
  const handleToggleChapter = (bookId: string, chapterId: string) => {
    const updated = books.map(b => {
      if (b.id === bookId) {
        const updatedChapters = b.chapters.map(ch => {
          if (ch.id === chapterId) {
            const nextDone = !ch.completed;
            if (nextDone) {
              confetti({
                particleCount: 50,
                spread: 50,
                origin: { y: 0.6 },
                colors: [b.color, '#10b981', '#38bdf8'],
              });
            }
            return {
              ...ch,
              completed: nextDone,
              completedAt: nextDone ? new Date().toISOString() : undefined,
            };
          }
          return ch;
        });
        const updatedBook = { ...b, chapters: updatedChapters };
        if (selectedBook?.id === bookId) setSelectedBook(updatedBook);
        return updatedBook;
      }
      return b;
    });

    setBooks(updated);
    saveStudyBooks(updated);
  };

  // Add chapter to selected book
  const handleAddChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !newChapterTitle.trim()) return;

    const newCh: StudyChapter = {
      id: `ch-${Date.now()}`,
      title: newChapterTitle.trim(),
      estimatedMinutes: newChapterMinutes,
      completed: false,
    };

    const updated = books.map(b => {
      if (b.id === selectedBook.id) {
        const updatedBook = {
          ...b,
          chapters: [...b.chapters, newCh],
        };
        setSelectedBook(updatedBook);
        return updatedBook;
      }
      return b;
    });

    setBooks(updated);
    saveStudyBooks(updated);
    setNewChapterTitle('');
  };

  // Create new book / course
  const handleCreateBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newBook: StudyBook = {
      id: `book-${Date.now()}`,
      title: newTitle.trim(),
      code: newCode.trim() || 'MOD-1',
      category: newCategory.trim() || 'General',
      shelf: newShelf || activeShelfId,
      color: newColor,
      notes: newNotes.trim() || undefined,
      chapters: [],
      createdAt: new Date().toISOString(),
    };

    const next = [...books, newBook];
    setBooks(next);
    saveStudyBooks(next);

    setNewTitle('');
    setNewCode('');
    setNewNotes('');
    setIsAddBookModalOpen(false);
    setSelectedBook(newBook);
  };

  // Delete book
  const handleDeleteBook = (id: string) => {
    if (!confirm('Are you sure you want to delete this study book/course?')) return;
    const next = books.filter(b => b.id !== id);
    setBooks(next);
    saveStudyBooks(next);
    setSelectedBook(null);
  };

  // Push chapter to Today's planner
  const handlePushChapterToToday = (chapter: StudyChapter) => {
    if (!onPushToToday || !selectedBook) return;
    const taskTitle = `[${selectedBook.code}] ${chapter.title}`;
    const notes = `From Study Room: ${selectedBook.title} (${chapter.estimatedMinutes} mins focus)`;
    onPushToToday(taskTitle, notes);
    confetti({
      particleCount: 40,
      spread: 40,
      origin: { y: 0.6 },
      colors: ['#f59e0b', '#38bdf8', '#10b981'],
    });
  };

  // Timer controls
  const handleStartTimer = (mins: number) => {
    setPomodoroMinutes(mins);
    setPomodoroRemaining(mins * 60);
    setIsTimerActive(true);
  };

  const handleResetTimer = () => {
    setIsTimerActive(false);
    setPomodoroRemaining(pomodoroMinutes * 60);
  };

  const timerMins = Math.floor(pomodoroRemaining / 60);
  const timerSecs = pomodoroRemaining % 60;

  // Filter books for active shelf
  const currentShelfBooks = books.filter(b => (b.shelf || 'subjects') === activeShelfId);
  const activeShelfObj = STUDY_SHELVES.find(s => s.id === activeShelfId) || STUDY_SHELVES[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-dark-900/90 border border-dark-800 backdrop-blur-xl shadow-2xl relative overflow-hidden">
        {/* Soft Amber Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1 relative z-10">
          <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400 uppercase tracking-widest">
            <BookOpen className="w-4 h-4" />
            <span>Deep Work & Curriculum Center</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-theme-title font-sans flex items-center space-x-3">
            <span>STUDY ROOM</span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              High Focus
            </span>
          </h2>
          <p className="text-xs text-dark-400">
            Structure your coursework, track chapter-by-chapter mastery, and execute deep work sprints.
          </p>
        </div>

        {/* Ambient Sound & Focus Timer Launcher */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-dark-950/80 border border-dark-800 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-bold text-white tabular-nums">
              {String(timerMins).padStart(2, '0')}:{String(timerSecs).padStart(2, '0')}
            </span>
            <button
              onClick={() => handleStartTimer(25)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                pomodoroMinutes === 25 ? 'bg-amber-500/20 text-amber-300' : 'text-dark-400 hover:text-white'
              }`}
            >
              25m
            </button>
            <button
              onClick={() => handleStartTimer(50)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                pomodoroMinutes === 50 ? 'bg-amber-500/20 text-amber-300' : 'text-dark-400 hover:text-white'
              }`}
            >
              50m
            </button>
            <button
              onClick={() => setIsTimerActive(!isTimerActive)}
              className="p-1 rounded-lg hover:bg-dark-800 text-dark-300 hover:text-white transition-colors ml-1"
              title={isTimerActive ? 'Pause Timer' : 'Start Timer'}
            >
              {isTimerActive ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3" />}
            </button>
            <button
              onClick={handleResetTimer}
              className="p-1 rounded-lg hover:bg-dark-800 text-dark-300 hover:text-white transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Ambient Noise Pills */}
          <button
            onClick={() => handleToggleAmbient('binaural')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border ${
              ambientSound === 'binaural'
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-glow-accent'
                : 'bg-dark-950/80 border-dark-800 text-dark-400 hover:text-white'
            }`}
            title="10 Hz Alpha Focus Binaural Wave"
          >
            <Headphones className="w-3 h-3" />
            <span>Alpha Wave</span>
          </button>
          <button
            onClick={() => handleToggleAmbient('rain')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 border ${
              ambientSound === 'rain'
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 shadow-glow-accent'
                : 'bg-dark-950/80 border-dark-800 text-dark-400 hover:text-white'
            }`}
          >
            <Volume2 className="w-3 h-3" />
            <span>Library Rain</span>
          </button>
        </div>
      </div>

      {/* Multi-Shelf Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-dark-900 border border-dark-800 shadow-sm">
        <div className="flex items-center space-x-2 overflow-x-auto scrollbar-none">
          {STUDY_SHELVES.map(shelf => {
            const isSelected = activeShelfId === shelf.id;
            const count = books.filter(b => (b.shelf || 'subjects') === shelf.id).length;

            return (
              <button
                key={shelf.id}
                onClick={() => setActiveShelfId(shelf.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-sm'
                    : 'bg-dark-950/60 border-dark-800/80 text-dark-400 hover:text-white hover:border-dark-700'
                }`}
              >
                {shelf.id === 'courses' ? (
                  <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                ) : shelf.id === 'reading' ? (
                  <Bookmark className="w-3.5 h-3.5 text-purple-400" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span>{shelf.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-amber-500/25 text-amber-200' : 'bg-dark-850 text-dark-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => {
            setNewShelf(activeShelfId);
            setIsAddBookModalOpen(true);
          }}
          className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-950 text-xs font-bold transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>
            {activeShelfId === 'courses'
              ? 'Add Course'
              : activeShelfId === 'reading'
              ? 'Add Reading'
              : 'Add Subject'}
          </span>
        </button>
      </div>

      {/* Visual Bookshelf Canvas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-base font-black text-theme-title font-sans flex items-center space-x-2">
              <span>{activeShelfObj.name}</span>
              <span className="text-xs text-dark-400 font-normal">
                ({currentShelfBooks.length} {currentShelfBooks.length === 1 ? 'item' : 'items'} on shelf)
              </span>
            </h3>
            <p className="text-xs text-dark-400">{activeShelfObj.description}</p>
          </div>
          <span className="hidden sm:inline-block text-xs text-dark-400 italic font-medium">
            Click any book to open chapters & syllabus
          </span>
        </div>

        {/* Physical Shelf Display */}
        <div className="p-8 rounded-3xl bg-gradient-to-b from-dark-900/90 via-dark-950/95 to-dark-950 border border-dark-800 relative shadow-2xl overflow-hidden">
          {currentShelfBooks.length === 0 ? (
            /* Clean Empty Shelf State */
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
                {activeShelfId === 'courses' ? (
                  <GraduationCap className="w-8 h-8" />
                ) : activeShelfId === 'reading' ? (
                  <Bookmark className="w-8 h-8" />
                ) : (
                  <BookOpen className="w-8 h-8" />
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-theme-title">This Shelf is Empty</h4>
                <p className="text-xs text-dark-400 leading-relaxed">
                  Start fresh with your own curriculum. Add a course, subject, or reading book with its syllabus to track progress.
                </p>
              </div>
              <button
                onClick={() => {
                  setNewShelf(activeShelfId);
                  setIsAddBookModalOpen(true);
                }}
                className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-950 text-xs font-bold transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {activeShelfId === 'courses'
                    ? 'Add Your First Course'
                    : activeShelfId === 'reading'
                    ? 'Add Reading Book'
                    : 'Add Academic Subject'}
                </span>
              </button>
            </div>
          ) : (
            /* Books Loaded on Shelf */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 items-end min-h-[240px]">
              {currentShelfBooks.map(book => {
                const totalCh = book.chapters.length;
                const doneCh = book.chapters.filter(c => c.completed).length;
                const pct = totalCh > 0 ? Math.round((doneCh / totalCh) * 100) : 0;

                return (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className="group flex flex-col items-center cursor-pointer transform hover:-translate-y-4 transition-all duration-300"
                  >
                    {/* Realistic 3D Book Spine */}
                    <div
                      className="w-24 sm:w-28 h-56 rounded-r-xl rounded-l-sm p-3 flex flex-col justify-between relative shadow-2xl border-l-4 transition-all duration-300 group-hover:shadow-glow-accent"
                      style={{
                        backgroundColor: '#0c1017',
                        borderColor: book.color,
                        borderRight: `2px solid ${book.color}40`,
                        boxShadow: `inset 4px 0 10px rgba(0,0,0,0.8), 0 12px 25px rgba(0,0,0,0.7)`,
                      }}
                    >
                      {/* Top Spine Ribbon & Code */}
                      <div className="space-y-1">
                        <div
                          className="text-[10px] font-mono font-black uppercase tracking-wider px-1.5 py-0.5 rounded truncate"
                          style={{ backgroundColor: `${book.color}25`, color: book.color }}
                        >
                          {book.code}
                        </div>
                        <div className="h-0.5 w-full bg-dark-700/60" />
                      </div>

                      {/* Book Title (Vertical / Stacked) */}
                      <div className="py-2">
                        <h4 className="text-xs font-bold text-white line-clamp-3 leading-snug group-hover:text-amber-300 transition-colors">
                          {book.title}
                        </h4>
                        <span className="text-[9px] text-dark-400 block mt-1 truncate">
                          {book.category}
                        </span>
                      </div>

                      {/* Bottom Progress Ring */}
                      <div className="pt-2 border-t border-dark-800/80 flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-dark-300">
                          {doneCh}/{totalCh}
                        </span>
                        <span
                          className="text-[10px] font-mono font-black"
                          style={{ color: pct === 100 ? '#10b981' : book.color }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Book Base Shadow */}
                    <div className="w-20 h-2 bg-black/70 rounded-full blur-sm mt-1 transform group-hover:scale-75 transition-transform" />
                  </div>
                );
              })}

              {/* Add Book Placeholder Slot on Shelf */}
              <div
                onClick={() => {
                  setNewShelf(activeShelfId);
                  setIsAddBookModalOpen(true);
                }}
                className="group flex flex-col items-center cursor-pointer transform hover:-translate-y-2 transition-all duration-300"
              >
                <div className="w-24 sm:w-28 h-56 rounded-xl border-2 border-dashed border-dark-750 hover:border-amber-500/60 p-4 flex flex-col items-center justify-center text-center space-y-2 bg-dark-950/40 hover:bg-dark-900/60 transition-colors">
                  <Plus className="w-6 h-6 text-dark-500 group-hover:text-amber-400 group-hover:scale-125 transition-all" />
                  <span className="text-xs font-bold text-dark-400 group-hover:text-white">New Item</span>
                </div>
              </div>
            </div>
          )}

          {/* Wooden / Obsidian Shelf Baseline Ledge */}
          <div className="w-full h-5 bg-gradient-to-r from-amber-950/80 via-amber-900/90 to-amber-950/80 rounded-b-xl border-t-2 border-amber-600/40 shadow-2xl mt-4 relative">
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40" />
          </div>
        </div>
      </div>

      {/* Selected Book Workspace Modal */}
      {selectedBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-dark-900 border border-dark-800 rounded-3xl p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6 relative animate-fade-in">
            {/* Close Button */}
            <button
              onClick={() => setSelectedBook(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-dark-500 hover:text-white hover:bg-dark-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Book Header */}
            <div className="flex items-start space-x-4 pr-10">
              <div
                className="w-14 h-20 rounded-lg p-2 flex flex-col justify-between flex-shrink-0 shadow-lg border-l-4"
                style={{
                  backgroundColor: '#0c1017',
                  borderColor: selectedBook.color,
                }}
              >
                <span className="text-[9px] font-mono font-bold" style={{ color: selectedBook.color }}>
                  {selectedBook.code}
                </span>
                <Bookmark className="w-4 h-4 text-white/50" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded"
                    style={{ backgroundColor: `${selectedBook.color}20`, color: selectedBook.color }}
                  >
                    {selectedBook.code}
                  </span>
                  <span className="text-xs text-dark-400 font-semibold">{selectedBook.category}</span>
                  <span className="text-[10px] text-dark-500 font-mono uppercase">
                    • Shelf: {selectedBook.shelf || 'subjects'}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white">{selectedBook.title}</h3>
                {selectedBook.notes && (
                  <p className="text-xs text-dark-400 italic">{selectedBook.notes}</p>
                )}
              </div>
            </div>

            {/* Chapter Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-dark-800 pb-2">
                <h4 className="text-xs font-bold text-dark-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Syllabus & Chapter Checklist</span>
                </h4>
                <span className="text-xs font-mono font-bold text-amber-400">
                  {selectedBook.chapters.filter(c => c.completed).length} / {selectedBook.chapters.length} done
                </span>
              </div>

              {/* Chapters List */}
              <div className="space-y-2">
                {selectedBook.chapters.length === 0 ? (
                  <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 text-center text-xs text-dark-400">
                    No chapters or topics added yet. Add your first chapter below to begin tracking!
                  </div>
                ) : (
                  selectedBook.chapters.map((ch, idx) => (
                    <div
                      key={ch.id}
                      className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 transition-colors ${
                        ch.completed
                          ? 'bg-dark-950/40 border-dark-800/60 opacity-70'
                          : 'bg-dark-950 border-dark-800 hover:border-dark-750'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleChapter(selectedBook.id, ch.id)}
                        className="mt-0.5 text-amber-400 hover:scale-110 transition-transform flex-shrink-0"
                      >
                        {ch.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-dark-600 hover:text-amber-400" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-dark-500 font-mono">#{idx + 1}</span>
                          <h5
                            className={`text-sm font-bold truncate ${
                              ch.completed ? 'line-through text-dark-500' : 'text-theme-title'
                            }`}
                          >
                            {ch.title}
                          </h5>
                        </div>
                        {ch.notes && <p className="text-[11px] text-dark-400 mt-1">{ch.notes}</p>}
                      </div>

                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <span className="text-[10px] font-mono text-dark-400 bg-dark-900 px-2 py-0.5 rounded border border-dark-800">
                          ~{ch.estimatedMinutes}m
                        </span>
                        {onPushToToday && !ch.completed && (
                          <button
                            type="button"
                            onClick={() => handlePushChapterToToday(ch)}
                            className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs transition-colors"
                            title="Schedule this chapter for Today"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Chapter Form */}
              <form onSubmit={handleAddChapter} className="flex gap-2 pt-2">
                <input
                  type="text"
                  required
                  placeholder="Add next chapter or topic..."
                  value={newChapterTitle}
                  onChange={e => setNewChapterTitle(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-dark-950 border border-dark-800 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={newChapterMinutes}
                  onChange={e => setNewChapterMinutes(Number(e.target.value))}
                  className="w-16 px-2 py-2 rounded-xl bg-dark-950 border border-dark-800 text-xs text-white text-center font-mono"
                  title="Estimated Minutes"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-950 text-xs font-bold transition-colors"
                >
                  + Add
                </button>
              </form>
            </div>

            {/* Danger Zone: Delete Book */}
            <div className="pt-4 border-t border-dark-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => handleDeleteBook(selectedBook.id)}
                className="text-xs text-red-400 hover:text-red-300 flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Book / Course</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedBook(null)}
                className="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-white text-xs font-bold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Subject / Course Modal */}
      {isAddBookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-dark-900 border border-dark-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-theme-title">
                {newShelf === 'courses'
                  ? 'Add New Course'
                  : newShelf === 'reading'
                  ? 'Add Reading Book'
                  : 'Add Academic Subject'}
              </h3>
              <button
                onClick={() => setIsAddBookModalOpen(false)}
                className="text-dark-400 hover:text-white text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateBook} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-dark-300 block mb-1">Target Shelf</label>
                <select
                  value={newShelf}
                  onChange={e => setNewShelf(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-dark-800 text-xs text-white"
                >
                  <option value="courses">Course Shelf (Bootcamp, Certifications, Online Courses)</option>
                  <option value="subjects">Academic Subjects (Degree, Core Theory, STEM)</option>
                  <option value="reading">Reading & Reference (Books, Manuals, Literature)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-dark-300 block mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Full-Stack Web Development, Algorithms, Deep Work..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-dark-950 border border-dark-800 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-dark-300 block mb-1">Code / Label</label>
                  <input
                    type="text"
                    placeholder="e.g. CS-201, AWS-SAA"
                    value={newCode}
                    onChange={e => setNewCode(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-dark-950 border border-dark-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-dark-300 block mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Engineering, Tech"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-dark-950 border border-dark-800 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-dark-300 block mb-1">Spine Accent Color</label>
                <div className="flex items-center space-x-2">
                  {['#38bdf8', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#06b6d4'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        newColor === color ? 'scale-125 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-dark-300 block mb-1">Notes / Objectives</label>
                <textarea
                  rows={2}
                  placeholder="Goals, target completion date, syllabus link..."
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-dark-950 border border-dark-800 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-950 text-xs font-bold transition-colors"
                >
                  Create & Place on Shelf
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
