import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

const UsersPage = ({ searchQuery }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setUsers([]);
        setLoading(false);
        return;
      }

      console.log("UserPage is rendered");

      const usersRef = collection(db, "users");
      let q = usersRef;

      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        q = query(
          usersRef,
          where("displayNameLower", ">=", lowerQuery),
          where("displayNameLower", "<=", lowerQuery + "\uf8ff")
        );
      }

      const unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          try {
            const usersList = snapshot.docs
              .map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }))
              .filter((user) => user.id !== currentUser.uid);
            setUsers(usersList);
            setLoading(false);
          } catch (error) {
            console.error("Error fetching users:", error);
            setLoading(false);
          }
        },
        (error) => {
          console.error("Snapshot error:", error);
          setLoading(false);
        }
      );

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, [searchQuery]);

  const goToChat = (userId, photoURL, displayName) => {
    navigate(`/chat/${userId}`, {
      state: { photoURL, displayName },
    });
  };

  if (loading) return <p className="loading-text">Loading users...</p>;

  return (
    <div className="users-page">
      <h2 className="users-page__title">Chats</h2>
      <ul className="users-page__list">
        {users.length > 0 ? (
          users.map((user) => (
            <li
              key={user.id}
              onClick={() => goToChat(user.id, user.photoURL, user.displayName)}
              className="user-card"
            >
              <img
                src={user.photoURL || "https://via.placeholder.com/40"}
                alt={user.displayName}
                className="user-card__avatar"
              />
              <div className="user-card__info">
                <p className="user-card__name">{user.displayName}</p>
                <p className="user-card__email">{user.email}</p>
              </div>
            </li>
          ))
        ) : (
          <p>No users found</p>
        )}
      </ul>
    </div>
  );
};

export default UsersPage;
