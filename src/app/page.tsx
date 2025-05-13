'use client';

import React, { useState, useRef, useEffect, useCallback } from "react";
import { refinePromptOrGeneratePath } from './actions';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../contexts/AuthContext';
import { signInWithPopup, signOut, User, sendEmailVerification } from 'firebase/auth';
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
import { useRouter } from 'next/navigation';

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
  const [authError, setAuthError] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationEmailResent, setVerificationEmailResent] = useState(false);

  // Refs
  const conversationEndRef = useRef<HTMLDivElement>(null);

  // Auth
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Check email verification status
  useEffect(() => {
    if (!authLoading) {
      if (user && !user.emailVerified) {
        setShowVerificationModal(true);
      } else {
        setShowVerificationModal(false);
      }
    }
  }, [user, authLoading]);

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

    if (!user) {
      router.push('/login');
      return;
    }

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
    setStreamingMessageId(userMessageId + '_ai_stream_placeholder');

    try {
      let activeChatId = currentChatId;
      const userMessageToSaveToDb = { id: userMessageId, type: 'user' as const, text: currentInput };

      if (!activeChatId) { // New chat
        const newChatId = await createNewChatInFirestore(user.uid, currentInput, userMessageId);
        if (newChatId) {
          activeChatId = newChatId;
          setCurrentChatId(newChatId);
        } else {
          setMessages(prev => prev.filter(msg => msg.id !== userMessageId));
          setMessages(prev => [
            ...prev,
            { id: Date.now().toString(), type: 'error' as const, text: 'Failed to start new chat. Please try again.', timestamp: Timestamp.now() }
          ]);
          setIsLoading(false);
          setStreamingAI(null);
          setStreamingMessageId(null);
          return;
        }
      } else { // Existing chat
        await addMessageToChatInFirestore(user.uid, activeChatId, userMessageToSaveToDb);
      }

      // Call AI, only if we have an activeChatId
      if (activeChatId) {
        // Prepare history: use messages *before* adding the current user's input for the AI's context
        const conversationHistoryForAI = messages
          .filter(m => m.id !== userMessageId)
          .filter(m => m.type === 'user' || m.type === 'ai')
          .map(m => ({
            role: m.type === 'user' ? 'user' as const : 'model' as const,
            parts: [{ text: m.text }],
          }));

        const result = await refinePromptOrGeneratePath(currentInput, conversationHistoryForAI);

        setStreamingAI(null);
        setStreamingMessageId(null);

        if (result.success && result.data) {
          const aiMessagePayload = { id: Date.now().toString(), type: 'ai' as const, text: result.data };
          await addMessageToChatInFirestore(user.uid, activeChatId, aiMessagePayload);
        } else {
          const errorText = result.error || 'AI failed to respond.';
          const errorMessagePayload = { id: Date.now().toString(), type: 'error' as const, text: errorText };
          await addMessageToChatInFirestore(user.uid, activeChatId, errorMessagePayload);
        }
      }
    } catch (error: any) {
      console.error('Error in handleSubmit:', error);
      setMessages(prev => prev.filter(msg => msg.id !== userMessageId));
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), type: 'error' as const, text: error.message || 'An unexpected error occurred.', timestamp: Timestamp.now() }
      ]);
      setStreamingAI(null);
      setStreamingMessageId(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    if (user && !user.emailVerified) {
      try {
        await sendEmailVerification(user);
        setVerificationEmailResent(true);
        setTimeout(() => setVerificationEmailResent(false), 15000); // Message visible for 15s
      } catch (error) {
        console.error("Error resending verification email:", error);
        alert("Failed to resend verification email. Please try again later.");
      }
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-100 dark:bg-neutral-900">
        <p className="text-xl text-slate-700 dark:text-slate-300">Loading application...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center font-sans p-4 bg-neutral-100 dark:bg-neutral-900 ${theme}`}>
        <div className="absolute top-0 right-0 p-4">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2m11-11h-2M3 12H1m16.95 7.07l-1.41-1.41M6.34 6.34L4.93 4.93m12.02 0l-1.41 1.41M6.34 17.66l-1.41 1.41"/></svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"/></svg>
            )}
          </button>
        </div>
        <div className="w-full max-w-lg p-6 sm:p-8 shadow-xl bg-background text-foreground rounded-xl border border-border">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-center mb-2">Welcome to PromptTune!</h2>
          </div>
          <div className="space-y-4 text-center text-muted-foreground mb-6">
            <p>
              Unlock the full potential of AI by crafting powerful and effective prompts with ease.
              PromptTune helps you refine your ideas into perfectly structured instructions for any AI.
            </p>
            <p>
              Get tailored suggestions for Beginner, Intermediate, and Advanced levels, ready to copy and paste!
            </p>
          </div>
          <div className="flex justify-center mt-6">
            <button
              className="w-full sm:w-auto bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2 px-6 rounded-lg text-lg transition-colors"
              onClick={() => router.push('/login')}
            >
              Get Started & Login
            </button>
          </div>
        </div>
        {/* SEO Rich Content Section */}
        <section className="mt-12 w-full max-w-2xl text-center text-sm text-slate-600 dark:text-slate-400 space-y-4 px-4">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-4">
            PromptTune: Your AI Prompt Generator &amp; Engineering Assistant
          </h1>
          <p className="text-base text-slate-700 dark:text-slate-300 mb-2">
            Welcome to PromptTune, the AI assistant that makes prompt engineering simple and accessible for everyone. Whether you&apos;re new to AI or an experienced user, PromptTune helps you craft effective prompts for any model—no guesswork required. Get started with Beginner, Intermediate, and Advanced prompts, and unlock the full power of AI with clear guidance and instant results.
          </p>
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mt-8">Why PromptTune?</h2>
          <p>
            Unlock the true power of artificial intelligence with PromptTune, your expert AI prompt engineering assistant. We guide you in crafting precise, effective prompts for any AI model, including ChatGPT, Gemini, and more. Whether you&apos;re a beginner taking your first steps or an expert looking to refine complex instructions, PromptTune provides structured examples and clear explanations across Beginner, Intermediate, and Advanced levels.
          </p>
          <p>
            Stop guessing and start generating! Improve your AI interactions, get better results, and save time with our intuitive prompt generator. Explore prompt creation for coding, creative writing, data analysis, image generation, and countless other applications.
          </p>
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 pt-2">Features:</h3>
          <ul className="list-disc list-inside text-left mx-auto max-w-md space-y-2">
            <li><b>Leveled Prompt Generation (Beginner, Intermediate, Advanced):</b> Access a powerful AI prompt generator that tailors suggestions to your experience level, making prompt engineering easy for everyone.</li>
            <li><b>Clear Explanations:</b> Every prompt includes a concise explanation, so you understand how and why it works—empowering you to craft better prompts.</li>
            <li><b>Contextual Chat Refinement:</b> Use our AI assistant to iteratively improve your prompts in a conversational interface, ensuring optimal results for any task.</li>
            <li><b>Easy Copy-Paste:</b> Instantly copy prompts for use in ChatGPT, Gemini, or any AI tool—no friction, just productivity.</li>
            <li><b>Supports Multiple AI Models:</b> PromptTune is designed for compatibility with a wide range of AI systems, helping you craft prompts for any use case.</li>
          </ul>
          {/* Who Can Benefit Section */}
          <div className="mt-10 text-left mx-auto max-w-2xl">
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">Who Can Benefit from PromptTune?</h2>
            <p className="mb-2">
              PromptTune is for anyone looking to improve their AI interactions—regardless of background or experience. Content creators can generate creative ideas and refine writing prompts, while developers and technical professionals can craft precise prompts for coding assistants, data analysis, and automation. Students and researchers benefit from better questions, summaries, and deeper exploration of new topics.
            </p>
            <p>
              Marketers, business professionals, and those new to AI will find PromptTune&apos;s intuitive interface and leveled prompt generator especially approachable—no jargon or prior experience required. Advanced users can leverage powerful prompt engineering tools and contextual chat refinement to unlock the full capabilities of any AI assistant. Whether you&apos;re just starting out or aiming to master prompt engineering, PromptTune is your guide to smarter, more effective AI results.
            </p>
          </div>
          {/* Call to Action */}
          <div className="mt-8 text-center">
            <p className="text-lg font-semibold text-sky-700 dark:text-sky-400">
              Ready to unlock the full potential of AI? Sign up for PromptTune—your all-in-one AI prompt generator and engineering assistant—and start crafting powerful prompts with ease. Join today and elevate your AI results, no experience required!
            </p>
          </div>
        </section>
      </div>
    );
  }

  // If user is logged in, render the main chat application UI:
  return (
    <>
      {/* Email Verification Modal */}
      {showVerificationModal && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/70" aria-hidden="true" />
          <div className="relative z-50 w-full max-w-lg p-6 bg-white dark:bg-slate-900 rounded-xl shadow-2xl">
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                Verify Your Email Address
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                To continue using PromptTune and save your chat history, please verify your email address.
                We&apos;ve sent a verification link to <strong className="text-slate-900 dark:text-slate-100">{user.email}</strong>.
                Please check your inbox (and spam folder).
              </p>
              <div className="space-y-3">
                <button
                  onClick={async () => {
                    if (user) {
                      try {
                        await user.reload();
                        if (user.emailVerified) {
                          setShowVerificationModal(false);
                        } else {
                          alert("Email still not verified. Please check your inbox or try resending.");
                        }
                      } catch (error) {
                        console.error("Error reloading user:", error);
                        alert("Could not refresh verification status. Please try again.");
                      }
                    }
                  }}
                  className="w-full py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  I&apos;ve Verified / Refresh Status
                </button>
                <button
                  onClick={handleResendVerificationEmail}
                  disabled={verificationEmailResent}
                  className="w-full py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {verificationEmailResent ? 'Verification Email Sent!' : 'Resend Verification Email'}
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full py-2 px-4 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat UI */}
      <div className={`flex flex-col h-screen overflow-hidden font-sans bg-background text-foreground ${showVerificationModal ? 'filter blur-sm pointer-events-none' : ''}`}>
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
                <h1 className="text-2xl font-bold mb-8">Welcome to PromptTune! AI</h1>
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
    </>
  );
}
