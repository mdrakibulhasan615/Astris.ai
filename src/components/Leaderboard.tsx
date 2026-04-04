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
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
          <Trophy className="w-7 h-7" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">Global Leaderboard</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading leaderboard...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="py-4 px-6 font-semibold text-gray-600">Rank</th>
                <th className="py-4 px-6 font-semibold text-gray-600">Student</th>
                <th className="py-4 px-6 font-semibold text-gray-600 text-right">Papers Completed</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((leader, index) => (
                <tr key={leader.id} className={`border-b border-gray-100 last:border-0 ${leader.id === user?.uid ? 'bg-indigo-50/50' : ''}`}>
                  <td className="py-4 px-6">
                    <div className="flex items-center">
                      {index === 0 ? <Medal className="w-6 h-6 text-yellow-500" /> :
                       index === 1 ? <Medal className="w-6 h-6 text-gray-400" /> :
                       index === 2 ? <Medal className="w-6 h-6 text-amber-700" /> :
                       <span className="text-gray-500 font-medium w-6 text-center">{index + 1}</span>}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {leader.photoURL ? (
                        <img src={leader.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm">
                          {leader.displayName?.charAt(0) || 'S'}
                        </div>
                      )}
                      <span className={`font-medium ${leader.id === user?.uid ? 'text-indigo-700' : 'text-gray-900'}`}>
                        {leader.displayName || 'Anonymous Student'}
                        {leader.id === user?.uid && ' (You)'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 text-gray-900 font-bold">
                      {leader.papersCompleted || 0}
                      <Award className="w-4 h-4 text-indigo-500" />
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
