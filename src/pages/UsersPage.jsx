import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        const usersList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const goToChat = (userId, photoURL, displayName) => {
    navigate(`/chat/${userId}`, {
      state: { photoURL, displayName },
    });
  };

  if (loading) return <p>Loading users...</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Registered Users</h2>
      <ul className="space-y-4">
        {users.map((user) => {
          console.log(user.photoURL);
          return (
            <li
              key={user.id}
              onClick={() => goToChat(user.id, user.photoURL, user.displayName)}
              className="border p-3 rounded shadow-md pointer hover:bg-gray-100 transition"
            >
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-10 h-10 rounded-full inline-block mr-2"
              />
              <div className="inline-block align-middle">
                <p className="font-semibold">{user.displayName}</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default UsersPage;
