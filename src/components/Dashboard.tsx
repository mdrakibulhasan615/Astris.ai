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
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Welcome back, {user?.displayName?.split(' ')[0]}!</h2>
        
        <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer font-medium shadow-sm">
          {uploading ? (
            <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Uploading...</span>
          ) : (
            <><Upload className="w-5 h-5" /> Upload Paper</>
          )}
          <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <h3 className="text-xs md:text-sm font-medium text-gray-500 mb-1">Papers Completed</h3>
          <p className="text-3xl md:text-4xl font-bold text-indigo-600">0</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <h3 className="text-xs md:text-sm font-medium text-gray-500 mb-1">In Progress</h3>
          <p className="text-3xl md:text-4xl font-bold text-amber-500">{papers.filter(p => p.status === 'in-progress').length}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <h3 className="text-xs md:text-sm font-medium text-gray-500 mb-1">Average Score</h3>
          <p className="text-3xl md:text-4xl font-bold text-emerald-500">-</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <h3 className="text-xs md:text-sm font-medium text-gray-500 mb-1">Global Rank</h3>
          <p className="text-3xl md:text-4xl font-bold text-purple-600">#42</p>
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-4">Your Papers</h3>
      
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading your papers...</div>
      ) : papers.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No papers yet</h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">Upload a past year paper or question paper to start practicing, annotating, and getting AI feedback.</p>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer font-medium shadow-sm">
            <Plus className="w-5 h-5" />
            Select PDF
            <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {papers.map(paper => (
            <div key={paper.id} onClick={() => navigate(`/paper/${paper.id}`)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <FileText className="w-6 h-6" />
                </div>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${paper.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {paper.status === 'completed' ? 'Completed' : 'In Progress'}
                </span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1 line-clamp-1">{paper.title}</h4>
              <p className="text-sm text-gray-500">Last updated {new Date(paper.updatedAt).toLocaleDateString()}</p>
              
              {paper.score !== undefined && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Score</span>
                  <span className="font-semibold text-indigo-600">{paper.score}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
