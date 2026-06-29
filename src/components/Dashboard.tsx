import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Upload, FileText, Plus } from 'lucide-react';
import localforage from 'localforage';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchPapers = async () => {
      if (!user) return;
      const q = query(collection(db, 'user_papers'), where('userId', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const fetchedPapers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPapers(fetchedPapers.sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
      setLoading(false);
    };
    fetchPapers();
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      // 1. Create document in Firestore first to get an ID
      const docRef = await addDoc(collection(db, 'user_papers'), {
        userId: user.uid,
        title: file.name.replace('.pdf', ''),
        fileUrl: 'local', // Indicate it's stored locally
        status: 'in-progress',
        updatedAt: new Date().toISOString()
      });

      // 2. Store file in IndexedDB using localforage
      await localforage.setItem(`paper_${docRef.id}`, file);

      // 3. Navigate to viewer
      navigate(`/paper/${docRef.id}`);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      alert(`Failed to upload paper: ${error.message || error}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-1">Welcome back, {user?.displayName?.split(' ')[0]}</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Ready to conquer your next paper?</p>
        </div>
        
        <label className="group flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-2xl hover:bg-indigo-600 transition-all cursor-pointer font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95">
          {uploading ? (
            <span className="flex items-center gap-2"><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Uploading...</span>
          ) : (
            <><Upload className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" /> Upload Paper</>
          )}
          <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white dark:border-gray-800 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 tracking-wide uppercase">Completed</h3>
          <p className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">0</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white dark:border-gray-800 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/5 dark:bg-amber-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 tracking-wide uppercase">In Progress</h3>
          <p className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">{papers.filter(p => p.status === 'in-progress').length}</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white dark:border-gray-800 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 tracking-wide uppercase">Avg Score</h3>
          <p className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">-</p>
        </div>
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-white dark:border-gray-800 flex flex-col justify-center relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/5 dark:bg-purple-500/10 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 tracking-wide uppercase">Global Rank</h3>
          <p className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white tracking-tight">#42</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Your Papers</h3>
        
        {loading ? (
          <div className="text-center py-20 text-gray-500 dark:text-gray-400 font-medium animate-pulse">Loading your papers...</div>
        ) : papers.length === 0 ? (
          <div className="bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-2 border-dashed border-gray-300/50 dark:border-gray-700/50 rounded-3xl p-16 text-center transition-all hover:bg-white/80 dark:hover:bg-gray-900/80">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner dark:shadow-none">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No papers yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto font-medium">Upload a past year paper or question paper to start practicing, annotating, and getting AI feedback.</p>
            <label className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md transition-all cursor-pointer font-semibold shadow-sm active:scale-95">
              <Plus className="w-5 h-5" />
              Select PDF
              <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {papers.map(paper => (
              <div key={paper.id} onClick={() => navigate(`/paper/${paper.id}`)} className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-white dark:border-gray-800 p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:border-gray-700 hover:-translate-y-1 transition-all cursor-pointer group flex flex-col">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800 text-indigo-500 rounded-2xl flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors shadow-sm dark:shadow-none">
                    <FileText className="w-7 h-7" />
                  </div>
                  <span className={`px-3 py-1.5 text-xs font-semibold rounded-full shadow-sm dark:shadow-none ${paper.status === 'completed' ? 'bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 backdrop-blur-md' : 'bg-amber-100/80 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 backdrop-blur-md'}`}>
                    {paper.status === 'completed' ? 'Completed' : 'In Progress'}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{paper.title}</h4>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-auto">Modified {new Date(paper.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                
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
