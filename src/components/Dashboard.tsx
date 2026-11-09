import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Upload, FileText, Plus, Trash2, Flame, Trophy, Award } from 'lucide-react';
import localforage from 'localforage';
import { motion } from 'motion/react';
import DailyStreakCard from './DailyStreakCard';
import { calculateStreak, StreakData } from '../lib/streak';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [streakData, setStreakData] = useState<StreakData>(() => calculateStreak([]));
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return;
      try {
        // 1. Fetch user's papers
        const q = query(collection(db, 'user_papers'), where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const fetchedPapers: any[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sortedPapers: any[] = fetchedPapers.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setPapers(sortedPapers);

        // 2. Fetch user profile stats from Firestore
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : null;

        // 3. Collect all practice timestamps
        const practiceTimestamps: (string | Date)[] = [];
        sortedPapers.forEach((p: any) => {
          if (p.updatedAt) practiceTimestamps.push(p.updatedAt);
        });
        if (userData?.lastPracticeDate) {
          practiceTimestamps.push(userData.lastPracticeDate);
        }

        // Also check any locally recorded practice timestamps
        try {
          const localDates = localStorage.getItem(`astris_practice_dates_${user.uid}`);
          if (localDates) {
            const parsed = JSON.parse(localDates);
            if (Array.isArray(parsed)) practiceTimestamps.push(...parsed);
          }
        } catch {
          // ignore localStorage error
        }

        // 4. Calculate streak
        const calculated = calculateStreak(practiceTimestamps);
        setStreakData(calculated);

        // 5. Sync streak to Firestore user profile if different or updated
        if (userSnap.exists()) {
          const prevStreak = userData?.streak || 0;
          const prevLongest = userData?.longestStreak || 0;
          if (
            prevStreak !== calculated.currentStreak ||
            prevLongest < calculated.longestStreak ||
            (calculated.hasPracticedToday && userData?.lastPracticeDate !== calculated.lastPracticeDate)
          ) {
            await updateDoc(userRef, {
              streak: calculated.currentStreak,
              longestStreak: Math.max(prevLongest, calculated.longestStreak),
              lastPracticeDate: calculated.lastPracticeDate || new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        console.error("Error loading dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const nowIso = new Date().toISOString();

      // 1. Create document in Firestore first to get an ID
      const docRef = await addDoc(collection(db, 'user_papers'), {
        userId: user.uid,
        title: file.name.replace('.pdf', ''),
        fileUrl: 'local', // Indicate it's stored locally
        status: 'in-progress',
        updatedAt: nowIso
      });

      // 2. Store file in IndexedDB using localforage
      await localforage.setItem(`paper_${docRef.id}`, file);

      // 3. Mark practice today locally
      try {
        const key = `astris_practice_dates_${user.uid}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.push(nowIso);
        localStorage.setItem(key, JSON.stringify(existing));
      } catch {
        // ignore
      }

      // 4. Navigate to viewer
      navigate(`/paper/${docRef.id}`);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      alert(`Failed to upload paper: ${error.message || error}`);
    } finally {
      setUploading(false);
    }
  };

  const handleQuickPractice = () => {
    const inProgress = papers.find(p => p.status === 'in-progress');
    if (inProgress) {
      navigate(`/paper/${inProgress.id}`);
    } else if (papers.length > 0) {
      navigate(`/paper/${papers[0].id}`);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleDeletePaper = async (e: React.MouseEvent, paperId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (confirmDeleteId !== paperId) {
      setConfirmDeleteId(paperId);
      setTimeout(() => {
        setConfirmDeleteId(current => current === paperId ? null : current);
      }, 3000);
      return;
    }

    try {
      await deleteDoc(doc(db, 'user_papers', paperId));
      await localforage.removeItem(`paper_${paperId}`);
      setPapers(papers.filter(p => p.id !== paperId));
    } catch (error) {
      console.error("Error deleting paper:", error);
      alert("Failed to delete paper.");
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // Metrics calculation
  const completedPapers = papers.filter(p => p.status === 'completed');
  const inProgressPapers = papers.filter(p => p.status === 'in-progress');
  const scoredPapers = papers.filter(p => typeof p.score === 'number');
  const avgScore = scoredPapers.length > 0
    ? `${Math.round(scoredPapers.reduce((acc, p) => acc + p.score, 0) / scoredPapers.length)}%`
    : '-';

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Hidden file input for quick upload triggers */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileUpload}
        disabled={uploading}
      />

      {/* Top Welcome Header & Upload Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">
            Welcome back, {user?.displayName?.split(' ')[0] || 'Student'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Ready to practice, annotate, and improve your score?
          </p>
        </div>
        
        <label className="group flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-600 transition-all cursor-pointer font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95">
          {uploading ? (
            <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Uploading...
            </span>
          ) : (
            <>
              <Upload className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
              Upload Paper
            </>
          )}
          <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>

      {/* Daily Streak Highlight Card with Flame & Progress Indicator */}
      <DailyStreakCard
        streakData={streakData}
        onQuickPractice={handleQuickPractice}
      />

      {/* High-Level Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Daily Streak Stat Card */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white dark:border-gray-800 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase">
              Daily Streak
            </h3>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              streakData.currentStreak > 0
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-sm shadow-orange-500/30'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
            }`}>
              <Flame className={`w-4 h-4 ${streakData.currentStreak > 0 ? 'fill-amber-200 stroke-white' : ''}`} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              {streakData.currentStreak}
            </p>
            <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
              {streakData.currentStreak === 1 ? 'day' : 'days'}
            </span>
          </div>
          <p className="text-xs font-semibold mt-1 text-orange-600 dark:text-orange-400 flex items-center gap-1">
            {streakData.hasPracticedToday ? '🔥 Practiced today' : '⚡ Practice to keep streak'}
          </p>
        </div>

        {/* Papers Completed Card */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white dark:border-gray-800 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase">
              Completed
            </h3>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {completedPapers.length}
          </p>
          <p className="text-xs font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
            {completedPapers.length === 1 ? '1 paper finished' : `${completedPapers.length} papers finished`}
          </p>
        </div>

        {/* In Progress Card */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white dark:border-gray-800 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 rounded-full group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase">
              In Progress
            </h3>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {inProgressPapers.length}
          </p>
          <p className="text-xs font-semibold mt-1 text-indigo-600 dark:text-indigo-400">
            {inProgressPapers.length === 1 ? '1 paper open' : `${inProgressPapers.length} papers open`}
          </p>
        </div>

        {/* Avg Score Card */}
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white dark:border-gray-800 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-violet-500/10 rounded-full group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 tracking-wide uppercase">
              Avg Score
            </h3>
            <div className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {avgScore}
          </p>
          <p className="text-xs font-semibold mt-1 text-violet-600 dark:text-violet-400">
            {scoredPapers.length > 0 ? `Across ${scoredPapers.length} graded papers` : 'Complete papers to get scored'}
          </p>
        </div>
      </div>

      {/* Papers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Your Papers</h3>
          {papers.length > 0 && (
            <span className="text-xs font-semibold px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
              {papers.length} {papers.length === 1 ? 'paper' : 'papers'}
            </span>
          )}
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center p-2.5 shadow-lg shadow-indigo-500/25">
              <motion.img 
                src="/logo.png" 
                alt="Loading..."
                animate={{ rotateY: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="w-full h-full object-contain filter drop-shadow"
              />
            </div>
          </div>
        ) : papers.length === 0 ? (
          <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-2 border-dashed border-gray-300/50 dark:border-gray-700/50 rounded-3xl p-12 sm:p-16 text-center transition-all hover:bg-white/80 dark:hover:bg-gray-900/80">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner dark:shadow-none">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No papers yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto font-medium text-sm">
              Upload a past year question paper to practice, annotate with Apple Pencil or mouse, and get instant AI feedback.
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md transition-all cursor-pointer font-semibold shadow-sm active:scale-95">
              <Plus className="w-5 h-5" />
              Select PDF Paper
              <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {papers.map(paper => (
              <div 
                key={paper.id} 
                onClick={() => navigate(`/paper/${paper.id}`)} 
                className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-white dark:border-gray-800 p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:border-gray-700 hover:-translate-y-1 transition-all cursor-pointer group flex flex-col"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 text-indigo-500 rounded-2xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors shadow-sm dark:shadow-none">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1.5 text-xs font-semibold rounded-full shadow-sm dark:shadow-none ${
                      paper.status === 'completed' 
                        ? 'bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 backdrop-blur-md' 
                        : 'bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 backdrop-blur-md'
                    }`}>
                      {paper.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                    <button 
                      onClick={(e) => handleDeletePaper(e, paper.id)} 
                      className={`p-1.5 flex items-center gap-1.5 rounded-lg transition-colors ${
                        confirmDeleteId === paper.id 
                          ? 'bg-red-500 text-white animate-pulse shadow-sm scale-105' 
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                      }`} 
                      title="Delete Paper"
                    >
                      <Trash2 className="w-4 h-4" />
                      {confirmDeleteId === paper.id && (
                        <span className="pr-1 text-[10px] font-semibold tracking-tight">Confirm?</span>
                      )}
                    </button>
                  </div>
                </div>

                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {paper.title}
                </h4>
                
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-auto">
                  Modified {new Date(paper.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                
                {paper.score !== undefined && (
                  <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Score</span>
                    <span className="text-lg font-black text-indigo-500 dark:text-indigo-400">{paper.score}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
