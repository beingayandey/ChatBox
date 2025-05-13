import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

// Initialize Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: import.meta.env.VITE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
export const db = getFirestore(app);

// Function to create a new chat between two users
export const createChat = async (participant1Id, participant2Id) => {
  try {
    const participants = [participant1Id, participant2Id].sort();
    const chatId = `chat_${participants[0]}_${participants[1]}`;
    const chatRef = doc(db, "storedChats", chatId);

    await setDoc(chatRef, {
      participants,
      lastMessage: "",
      lastUpdated: serverTimestamp(),
      typing: {}, // Initialize typing field
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
      read: false,
    });

    const chatRef = doc(db, "storedChats", chatId);
    await setDoc(
      chatRef,
      {
        lastMessage: content,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );

    // Update recipient's unreadChats
    const chatDoc = await getDoc(chatRef);
    const participants = chatDoc.data().participants;
    const recipientId = participants.find((id) => id !== senderId);
    const recipientRef = doc(db, "users", recipientId);
    await updateDoc(recipientRef, {
      unreadChats: arrayUnion(chatId),
    });

    return messageRef.id;
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
export const fetchMessages = (chatId, callback, limitNum = 20) => {
  try {
    const messagesRef = collection(db, "storedChats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(limitNum));

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

    // Remove chatId from user's unreadChats
    const userRef = doc(db, "users", userId);
    batch.update(userRef, {
      unreadChats: arrayRemove(chatId),
    });

    await batch.commit();
  } catch (error) {
    console.error("Error marking messages as read:", error);
    throw error;
  }
};

// Function to set typing status
export const setTypingStatus = async (chatId, userId, isTyping) => {
  try {
    const chatRef = doc(db, "storedChats", chatId);
    await updateDoc(chatRef, {
      [`typing.${userId}`]: isTyping,
    });
  } catch (error) {
    console.error("Error setting typing status:", error);
    throw error;
  }
};

// Function to delete a message
export const deleteMessage = async (chatId, messageId) => {
  try {
    const messageRef = doc(db, "storedChats", chatId, "messages", messageId);
    await deleteDoc(messageRef);

    // Update lastMessage if the deleted message was the last one
    const messagesRef = collection(db, "storedChats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "desc"), limit(1));
    const snapshot = await getDocs(q);
    const lastMsg = snapshot.docs[0]?.data() || { content: "" };
    await updateDoc(doc(db, "storedChats", chatId), {
      lastMessage: lastMsg.content,
      lastUpdated: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
};

export { auth, provider };
