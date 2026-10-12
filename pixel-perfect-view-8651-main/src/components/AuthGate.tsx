import { createContext, useContext, useEffect, useState, type ReactNode, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authRequest, type Account } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AuthContext = createContext<{user: Account; logout: () => Promise<void>} | null>(null);
export function AccountMenu() {
  const auth = useContext(AuthContext);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  if (!auth) return null;
  return <div className="flex flex-wrap items-center gap-2 text-sm"><span>{auth.user.email}</span><Button size="sm" variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await auth.logout();}catch{setError("Sign-out failed. Please retry.");}finally{setBusy(false);}}}>{busy ? "Signing out…" : "Sign out"}</Button>{error && <span role="alert">{error}</span>}</div>;
}
export function AuthGate({children}:{children:ReactNode}) {
  const qc=useQueryClient();
  const [user,setUser]=useState<Account|null>(null);
  const [checking,setChecking]=useState(true);
  const [register,setRegister]=useState(false);
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function load() {
    setChecking(true);setError("");
    try {setUser(await authRequest("me"));} catch {setError("Cannot connect to ApplyPilot. Keep the backend running and retry.");}
    finally {setChecking(false);}
  }
  useEffect(()=>{
    void load();
    const expired=()=>{void qc.cancelQueries();qc.clear();setUser(null);setPassword("");setError("Your session expired. Please sign in again.");};
    window.addEventListener("applypilot:unauthorized",expired);
    return ()=>window.removeEventListener("applypilot:unauthorized",expired);
  },[qc]);
  async function submit(e:FormEvent) {
    e.preventDefault();setBusy(true);setError("");
    try {const account=await authRequest(register?"register":"login",{email,password});await qc.cancelQueries();qc.clear();setUser(account);setPassword("");}
    catch(e){setError(e instanceof Error ? e.message : "Unable to sign in.");}
    finally{setBusy(false);}
  }
  if(checking) return <main className="flex min-h-screen items-center justify-center">Checking your session…</main>;
  if(user) return <AuthContext.Provider value={{user,logout:async()=>{await authRequest("logout",{});await qc.cancelQueries();qc.clear();setUser(null);setPassword("");setError("");}}}>{children}</AuthContext.Provider>;
  return <main className="flex min-h-screen items-center justify-center bg-background p-6"><section className="surface w-full max-w-md p-8">
    <p className="mb-8 text-xl font-semibold text-primary">ApplyPilot.</p>
    <h1 className="text-2xl font-semibold">{register?"Create your account":"Welcome back"}</h1>
    <p className="mt-2 mb-6 text-sm text-muted-foreground">Keep your applications, notes and next steps in your own workspace.</p>
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-2"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></div>
      <div className="space-y-2"><Label htmlFor="auth-password">Password</Label><Input id="auth-password" type="password" autoComplete={register?"new-password":"current-password"} required minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/>{register && <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>}</div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button className="w-full" disabled={busy}>{busy?"Please wait…":register?"Create account":"Sign in"}</Button>
    </form>
    <button className="mt-5 text-sm text-primary underline" disabled={busy} onClick={()=>{setRegister(!register);setError("");setPassword("");}}>{register?"Already have an account? Sign in":"New here? Create an account"}</button>
    {error.includes("connect") && <Button className="mt-3" variant="outline" onClick={()=>void load()}>Retry connection</Button>}
  </section></main>;
}
