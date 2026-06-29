import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trophy, Medal, Award } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const q = query(collection(db, 'users'), orderBy('papersCompleted', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      setLeaders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 rounded-xl flex items-center justify-center">
          <Trophy className="w-7 h-7" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Global Leaderboard</h2>
      </div>

      <div className="bg-white dark:bg-gray-900/80 backdrop-blur-xl rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading leaderboard...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th className="py-4 px-6 font-semibold text-gray-600 dark:text-gray-300">Rank</th>
                <th className="py-4 px-6 font-semibold text-gray-600 dark:text-gray-300">Student</th>
                <th className="py-4 px-6 font-semibold text-gray-600 dark:text-gray-300 text-right">Papers Completed</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((leader, index) => (
                <tr key={leader.id} className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 ${leader.id === user?.uid ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30'}`}>
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      {index === 0 ? <Medal className="w-6 h-6 text-yellow-500" /> :
                       index === 1 ? <Medal className="w-6 h-6 text-gray-400" /> :
                       index === 2 ? <Medal className="w-6 h-6 text-amber-700 dark:text-amber-600" /> :
                       <span className="text-gray-500 dark:text-gray-400 font-medium w-6 text-center">{index + 1}</span>}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {leader.photoURL ? (
                        <img src={leader.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                          {leader.displayName?.charAt(0) || 'S'}
                        </div>
                      )}
                      <span className={`font-medium ${leader.id === user?.uid ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-200'}`}>
                        {leader.displayName || 'Anonymous Student'}
                        {leader.id === user?.uid && ' (You)'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 text-gray-900 dark:text-gray-100 font-bold">
                      {leader.papersCompleted || 0}
                      <Award className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
