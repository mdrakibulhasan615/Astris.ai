import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, getDocs, doc, getDoc, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { Users, Search, UserPlus, UserMinus, UserCheck, Medal } from 'lucide-react';

export default function Friends() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      // Fetch current user doc to get friendIds
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        setFriendIds(data.friendIds || []);
      }

      // Fetch users for searching (limit to 100 for MVP)
      const q = query(collection(db, 'users'), limit(100));
      const snap = await getDocs(q);
      const usersList = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== user.uid);
      setAllUsers(usersList);
      
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleAddFriend = async (friendId: string) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      friendIds: arrayUnion(friendId)
    });
    setFriendIds(prev => [...prev, friendId]);
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      friendIds: arrayRemove(friendId)
    });
    setFriendIds(prev => prev.filter(id => id !== friendId));
  };

  const filteredUsers = searchQuery.trim() !== '' 
    ? allUsers.filter(u => u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const friends = allUsers.filter(u => friendIds.includes(u.id));

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 font-sans">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Friends</h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Connect and compete with your peers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-white dark:border-gray-800 p-6 md:p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Your Friends</h3>
            {loading ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 font-medium animate-pulse">Loading friends...</div>
            ) : friends.length === 0 ? (
              <div className="text-center py-12 bg-gray-50/50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                <Users className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No friends yet</h4>
                <p className="text-gray-500 dark:text-gray-400">Search for users and add them to your friends list.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friends.map(friend => (
                  <div key={friend.id} className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm dark:shadow-none">
                    <div className="flex items-center gap-3">
                      {friend.photoURL ? (
                        <img src={friend.photoURL} alt="" className="w-10 h-10 rounded-full ring-2 ring-white dark:ring-gray-700 shadow-sm" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                          {friend.displayName?.charAt(0) || 'S'}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{friend.displayName || 'Anonymous Student'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Medal className="w-3 h-3" />
                          {friend.papersCompleted || 0} papers
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRemoveFriend(friend.id)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                      title="Remove friend"
                    >
                      <UserMinus className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none border border-white dark:border-gray-800 p-6 md:p-8">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Find Users</h3>
            <div className="relative mb-6">
              <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search by name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-200/80 dark:border-gray-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 dark:focus:ring-indigo-400/50 dark:focus:border-indigo-400 transition-all font-medium dark:text-white dark:placeholder-gray-400"
              />
            </div>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {searchQuery.trim() !== '' && filteredUsers.length === 0 ? (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400 font-medium">No users found.</div>
              ) : (
                filteredUsers.map(u => {
                  const isFriend = friendIds.includes(u.id);
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-100 dark:hover:border-gray-700">
                      <div className="flex items-center gap-3">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full shadow-sm" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                            {u.displayName?.charAt(0) || 'S'}
                          </div>
                        )}
                        <span className="font-semibold text-gray-900 dark:text-white">{u.displayName || 'Anonymous Student'}</span>
                      </div>
                      {isFriend ? (
                        <div className="text-emerald-500 dark:text-emerald-400 p-2" title="Already friends">
                          <UserCheck className="w-5 h-5" />
                        </div>
                      ) : (
                        <button 
                          onClick={() => handleAddFriend(u.id)}
                          className="p-2 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-full transition-colors"
                          title="Add friend"
                        >
                          <UserPlus className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
              {searchQuery.trim() === '' && (
                <div className="text-center py-6 text-gray-400 font-medium">
                  Type to search for friends.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
