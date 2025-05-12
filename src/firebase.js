// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Function to create a new chat between two users
export const createChat = async (participant1Id, participant2Id) => {
  try {
    // Sort IDs to ensure consistent chat ID regardless of order
    const participants = [participant1Id, participant2Id].sort();
    const chatId = `chat_${participants[0]}_${participants[1]}`;
    const chatRef = doc(db, "storedChats", chatId);

    await setDoc(chatRef, {
      participants,
      lastMessage: "",
      lastUpdated: serverTimestamp(),
    });

    return chatId;
  } catch (error) {
    console.error("Error creating chat:", error);
    throw error;
  }
};

// Function to send a message in a chat
export const sendMessage = async (chatId, senderId, content) => {
  try {
    const messageRef = doc(collection(db, "storedChats", chatId, "messages"));
    await setDoc(messageRef, {
      senderId,
      content,
      timestamp: serverTimestamp(),
      read: false, // Initially unread
    });

    // Update the last message and timestamp in the chat
    await setDoc(
      doc(db, "storedChats", chatId),
      {
        lastMessage: content,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );

    return messageRef.id; // Return the message ID for potential updates
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};
// Function to fetch chats for a user (real-time listener)
export const fetchChats = (userId, callback) => {
  try {
    const q = query(
      collection(db, "storedChats"),
      where("participants", "array-contains", userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(chats);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error fetching chats:", error);
    throw error;
  }
};

// Function to fetch messages for a specific chat (real-time listener)
export const fetchMessages = (chatId, callback) => {
  try {
    const messagesRef = collection(db, "storedChats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(messages);
    });

    return unsubscribe;
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }
};

export { auth, provider };
// Function to mark messages as read
export const markMessagesAsRead = async (chatId, userId) => {
  try {
    const messagesRef = collection(db, "storedChats", chatId, "messages");
    const q = query(
      messagesRef,
      where("senderId", "!=", userId),
      where("read", "==", false)
    );
    const snapshot = await getDocs(q);

    const batch = writeBatch(db);
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
  } catch (error) {
    console.error("Error marking messages as read:", error);
    throw error;
  }
};
