'use client';

import React, { useState, useRef, useEffect, useCallback } from "react";
import { refinePromptOrGeneratePath } from './actions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../contexts/AuthContext';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider, firestore } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  serverTimestamp, 
  Timestamp,
  updateDoc,
  arrayUnion,
  deleteDoc,
  FieldValue
} from 'firebase/firestore';
import Link from 'next/link';
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import ChatAreaComponent from "./components/ChatArea";
import MessageInputComponent from "./components/MessageInput";

type Message = {
  id: string;
  type: 'user' | 'ai' | 'error';
  text: string;
  timestamp: Timestamp;
};

type ChatHistoryItem = {
  id: string;
  title: string;
  updatedAt: Timestamp;
};

interface TopBarProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  user: User | null;
  authLoading: boolean;
}

interface SidebarProps {
  isOpen: boolean;
  chatHistory: ChatHistoryItem[];
  currentChatId: string | null;
  onChatSelect: (chatId: string | null) => void;
  user: User | null;
}

function streamAIText(
  aiText: string,
  setStreamingAI: (s: string | null) => void,
  setStreamingId: (s: string | null) => void,
  setConversation: React.Dispatch<React.SetStateAction<Message[]>>
) {
  let i = 0;
  function streamNext() {
    setStreamingAI(aiText.slice(0, i + 1));
    if (i < aiText.length - 1) {
      i++;
      setTimeout(streamNext, aiText[i] === '\n' ? 0 : 22);
    } else {
      setConversation(prev => [
        ...prev,
        { id: Date.now().toString(), type: 'ai', text: aiText, timestamp: Timestamp.now() }
      ]);
      setStreamingAI(null);
      setStreamingId(null);
    }
  }
  streamNext();
}

// Helper functions for Firestore chat management
async function createNewChatInFirestore(userId: string, firstMessageText: string, firstMessageId: string): Promise<string | null> {
  try {
    const userMessageForFirestore = {
      id: firstMessageId,
      type: 'user' as const,
      text: firstMessageText,
      timestamp: Timestamp.now(),
    };
    const newChatRef = await addDoc(collection(firestore, 'users', userId, 'chats'), {
      title: firstMessageText.substring(0, 30) + (firstMessageText.length > 30 ? '...' : ''),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      messages: [userMessageForFirestore],
    });
    return newChatRef.id;
  } catch (e) {
    console.error("Error creating new chat in Firestore:", e);
    return null;
  }
}

async function addMessageToChatInFirestore(userId: string, chatId: string, messagePayload: { id: string; type: 'user' | 'ai' | 'error'; text: string; }) {
  try {
    const messageForFirestore = {
      ...messagePayload,
      timestamp: Timestamp.now(), // Use client-side timestamp for messages
    };
    const chatDocRef = doc(firestore, 'users', userId, 'chats', chatId);
    await updateDoc(chatDocRef, {
      messages: arrayUnion(messageForFirestore),
      updatedAt: serverTimestamp(), // Keep server timestamp for document metadata
    });
  } catch (e) {
    console.error("Error adding message to Firestore:", e);
  }
}

export default function HomePage() {
  // Core state variables
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [streamingAI, setStreamingAI] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [chatHistoryList, setChatHistoryList] = useState<ChatHistoryItem[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [anonymousMessageCount, setAnonymousMessageCount] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  // Refs
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Auth
  const { user, loading: authLoading } = useAuth();

  // Chat management functions
  const handleNewChat = useCallback(() => {
    setCurrentChatId(null);
    setMessages([]);
    setUserInput("");
    setStreamingAI(null);
    setStreamingMessageId(null);
    setIsSidebarOpen(false); // Close sidebar on mobile
  }, []);

  const handleSelectChat = useCallback((chatId: string) => {
    if (chatId === currentChatId) return;
    setCurrentChatId(chatId);
    setMessages([]); // Clear messages immediately
    setStreamingAI(null);
    setStreamingMessageId(null);
    setIsSidebarOpen(false); // Close sidebar on mobile
  }, [currentChatId]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentChatId(null);
      setMessages([]);
      setChatHistoryList([]);
      setUserInput("");
      setStreamingAI(null);
      setStreamingMessageId(null);
    } catch (error) {
      console.error("Error signing out:", error);
      setAuthError("Failed to sign out");
    }
  };

  const handleDeleteChat = useCallback(async (chatId: string) => {
    if (!user) return;
    
    if (!window.confirm("Are you sure you want to delete this chat?")) {
      return;
    }

    try {
      const chatRef = doc(firestore, 'users', user.uid, 'chats', chatId);
      await deleteDoc(chatRef);

      // If the deleted chat was the current one, start a new chat
      if (chatId === currentChatId) {
        handleNewChat();
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      setAuthError("Failed to delete chat");
    }
  }, [user, currentChatId, handleNewChat]);

  // Theme initialization and management
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(savedTheme);
    } else {
      setTheme('light');
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add('light');
    }
    setThemeLoaded(true);
  }, []);

  useEffect(() => {
    if (!themeLoaded) return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme, themeLoaded]);

  // Anonymous message count management
  useEffect(() => {
    const savedCount = localStorage.getItem('anonymousMessageCount');
    if (savedCount) {
      setAnonymousMessageCount(parseInt(savedCount));
    }
  }, []);

  useEffect(() => {
    if (user) {
      setAnonymousMessageCount(0);
      localStorage.removeItem('anonymousMessageCount');
    }
  }, [user]);

  // Auto-scroll effect
  useEffect(() => {
    if (messages.length > 0 || streamingAI) {
      conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingAI]);

  // Fetch chat history
  useEffect(() => {
    if (!user) {
      setChatHistoryList([]);
      return;
    }

    const chatsRef = collection(firestore, 'users', user.uid, 'chats');
    const q = query(chatsRef, orderBy('updatedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chats: ChatHistoryItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        chats.push({
          id: doc.id,
          title: data.title,
          updatedAt: data.updatedAt,
        });
      });
      setChatHistoryList(chats);
    }, (error) => {
      console.error("Error fetching chat history:", error);
      setAuthError("Failed to load chat history");
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch messages for current chat
  useEffect(() => {
    if (!user || !currentChatId) {
      setMessages([]);
      return;
    }

    const chatRef = doc(firestore, 'users', user.uid, 'chats', currentChatId);
    
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setMessages(data.messages || []);
      } else {
        setMessages([]);
      }
    }, (error) => {
      console.error("Error fetching messages:", error);
      setAuthError("Failed to load messages");
    });

    return () => unsubscribe();
  }, [user, currentChatId]);

  const handleSubmit = async () => {
    const currentInput = userInput.trim();
    if (!currentInput) return;

    // Check anonymous user limit
    if (!user && anonymousMessageCount >= 5) {
      setAuthError("Please sign in to continue chatting");
      return;
    }

    // Generate message ID
    const userMessageId = Date.now().toString();

    // Optimistic UI update for user message
    const optimisticUserMessage: Message = {
      id: userMessageId,
      type: 'user',
      text: currentInput,
      timestamp: Timestamp.now(),
    };

    setMessages(prev => [...prev, optimisticUserMessage]);
    setUserInput('');
    setIsLoading(true);
    setStreamingAI('');
    setStreamingMessageId(userMessageId);

    try {
      let activeChatId = currentChatId;

      // Handle logged-in user's message storage
      if (user) {
        if (!activeChatId) {
          // Create new chat
          const newChatId = await createNewChatInFirestore(user.uid, currentInput, userMessageId);
          if (!newChatId) {
            throw new Error("Failed to create new chat");
          }
          activeChatId = newChatId;
          setCurrentChatId(newChatId);
        } else {
          // Add message to existing chat
          await addMessageToChatInFirestore(user.uid, activeChatId, {
            id: userMessageId,
            type: 'user',
            text: currentInput,
          });
        }
      }

      // Prepare conversation history for AI
      const conversationHistoryForAI = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.text }]
      }));

      // Get AI response
      const result = await refinePromptOrGeneratePath(currentInput, conversationHistoryForAI);
      
      // Clear streaming states
      setStreamingAI(null);
      setStreamingMessageId(null);

      // Handle AI response
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessage: Message = {
        id: aiMessageId,
        type: result.success ? 'ai' : 'error',
        text: result.success ? (result.data as string) : (result.error as string || 'An error occurred'),
        timestamp: Timestamp.now(),
      };

      if (result.success) {
        if (user && activeChatId) {
          // Store AI response in Firestore
          await addMessageToChatInFirestore(user.uid, activeChatId, {
            id: aiMessageId,
            type: 'ai',
            text: result.data as string,
          });
        } else {
          // Update local state for anonymous user
          setMessages(prev => [...prev, aiMessage]);
          setAnonymousMessageCount(prev => {
            const newCount = prev + 1;
            localStorage.setItem('anonymousMessageCount', newCount.toString());
            return newCount;
          });
        }
      } else {
        if (user && activeChatId) {
          // Store error message in Firestore
          await addMessageToChatInFirestore(user.uid, activeChatId, {
            id: aiMessageId,
            type: 'error',
            text: result.error as string || 'An error occurred',
          });
        } else {
          // Update local state for anonymous user
          setMessages(prev => [...prev, aiMessage]);
        }
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
      setAuthError("Failed to process message");
      
      // Rollback optimistic UI update
      setMessages(prev => prev.filter(msg => msg.id !== userMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  if (!themeLoaded) {
    return null;
  }

  // Block app if required env variable is missing
  if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground font-sans">
        <div className="max-w-lg p-8 rounded-xl border border-destructive bg-destructive/10 text-destructive text-center shadow-lg">
          <h1 className="text-2xl font-bold mb-4">App Not Configured</h1>
          <p className="mb-2">This app is not configured for public use. Please set up your own Firebase and API keys in a <code>.env.local</code> file to run this project.</p>
          <p className="text-sm text-muted-foreground">See the README for setup instructions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans bg-background text-foreground">
      <TopBar 
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        user={user}
        authLoading={authLoading}
        onSignOut={handleSignOut}
        isSidebarOpen={isSidebarOpen}
      />
      
      <div className="flex-1 flex overflow-hidden pt-16">
        <Sidebar 
          isOpen={isSidebarOpen}
          onOpenChange={setIsSidebarOpen}
          chatHistory={chatHistoryList}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onSignOut={handleSignOut}
          onDeleteChat={handleDeleteChat}
          user={user}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4">
              <h1 className="text-2xl font-bold mb-8">Welcome to AI Chat</h1>
              <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
                <MessageInputComponent
                  value={userInput}
                  onChange={setUserInput}
                  onSend={handleSubmit}
                  disabled={isLoading}
                />
              </div>
            </div>
          ) : (
            <>
              <ChatAreaComponent
                messages={messages}
                streamingAI={streamingAI}
                isLoading={isLoading && !streamingAI}
                chatEndRef={conversationEndRef}
                streamingMessageId={streamingMessageId}
              />
              <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
                  <MessageInputComponent
                    value={userInput}
                    onChange={setUserInput}
                    onSend={handleSubmit}
                    disabled={isLoading}
                  />
                </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
