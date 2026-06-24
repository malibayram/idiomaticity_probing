import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { tx } from "@/i18n";
import type { Role } from "@/lib/roles";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: Role;
  schemaVersion: number;
}

interface AuthState {
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  isAnonymous: boolean;
  publicSessionError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const USER_SCHEMA_VERSION = 1;
const ANONYMOUS_PUBLIC_ACCESS = import.meta.env.VITE_ENABLE_ANONYMOUS_PUBLIC_ACCESS !== "false";
let anonymousSignInPromise: Promise<unknown> | null = null;

async function ensureAnonymousSession(): Promise<void> {
  if (auth.currentUser || !ANONYMOUS_PUBLIC_ACCESS) return;
  if (!anonymousSignInPromise) {
    anonymousSignInPromise = Promise.race([
      signInAnonymously(auth),
      new Promise((_, reject) => window.setTimeout(
        () => reject(new Error(tx("errors.anonymousSessionTimeout"))),
        8_000,
      )),
    ]).finally(() => { anonymousSignInPromise = null; });
  }
  await anonymousSignInPromise;
}

/** Create the /users/{uid} doc on first sign-in, defaulting to `pending`. */
async function ensureUserDoc(user: FirebaseUser): Promise<void> {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const bootstrapEmail = import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();
  const initialRole: Role = user.email?.toLowerCase() === bootstrapEmail ? "admin" : "pending";
  await setDoc(ref, {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: initialRole,
    schemaVersion: USER_SCHEMA_VERSION,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [publicSessionError, setPublicSessionError] = useState<string | null>(null);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      unsubProfile?.();
      unsubProfile = undefined;

      if (!user) {
        setFirebaseUser(null);
        setProfile(null);
        if (ANONYMOUS_PUBLIC_ACCESS) {
          try {
            await ensureAnonymousSession();
            return;
          } catch (err) {
            const message = err instanceof Error ? err.message : "Anonymous session failed";
            console.error("anonymous public session failed", err);
            setPublicSessionError(message);
          }
        }
        setLoading(false);
        return;
      }

      setFirebaseUser(user);
      setPublicSessionError(null);
      if (user.isAnonymous) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        await ensureUserDoc(user);
      } catch (err) {
        // Rules may reject the create until the doc is provisioned; surface in console.
        console.error("ensureUserDoc failed", err);
      }

      unsubProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          const data = snap.data();
          setProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: (data?.role as Role) ?? "pending",
            schemaVersion: (data?.schemaVersion as number) ?? USER_SCHEMA_VERSION,
          });
          setLoading(false);
        },
        (err) => {
          console.error("user profile snapshot error", err);
          setLoading(false);
        },
      );
    });

    return () => {
      unsubProfile?.();
      unsubAuth();
    };
  }, []);

  const value: AuthState = {
    loading,
    firebaseUser,
    profile,
    isAnonymous: firebaseUser?.isAnonymous ?? false,
    publicSessionError,
    signInWithGoogle: async () => {
      await signInWithPopup(auth, googleProvider);
    },
    signOut: async () => {
      await fbSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
