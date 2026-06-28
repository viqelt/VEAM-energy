import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, Lock, ArrowRight, X, Phone, Send, CheckCircle2, User, AlertCircle, Eye, EyeOff } from "lucide-react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotInput, setForgotInput] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const navigate = useNavigate();

  const getErrorMessage = (code: string) => {
    switch (code) {
      case "auth/user-not-found": return "No account found with this email.";
      case "auth/wrong-password": return "Incorrect password. Please try again.";
      case "auth/email-already-in-use": return "This email is already registered.";
      case "auth/weak-password": return "Password must be at least 6 characters.";
      case "auth/invalid-email": return "Please enter a valid email address.";
      case "auth/too-many-requests": return "Too many attempts. Please try again later.";
      case "auth/invalid-credential": return "Incorrect email or password.";
      default: return "Something went wrong. Please try again.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, {
          displayName: `${firstName} ${lastName}`.trim()
        });
      }
      sessionStorage.setItem("veam-logged-in", "true");
      navigate("/dashboard");
    } catch (err: any) {
      setError(getErrorMessage(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotInput);
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(getErrorMessage(err.code));
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgot(false);
    setForgotInput("");
    setForgotSent(false);
    setForgotLoading(false);
    setForgotError("");
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full blur-3xl opacity-60" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-blue-100 to-indigo-100 rounded-full blur-3xl opacity-60" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-indigo-50 to-purple-50 rounded-full blur-3xl opacity-40" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <img src="/logo.jpeg" className="w-16 h-16 rounded-2xl object-cover mb-4 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">VEAM</h1>
          <p className="text-gray-500 mt-1 text-sm">Visual Energy Analytics & Monitoring</p>
        </div>

        <Card className="border-0 shadow-xl shadow-gray-200/50 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl font-semibold text-gray-900">
              {isLogin ? "Welcome Back" : "Create Account"}
            </CardTitle>
            <CardDescription className="text-gray-500">
              {isLogin ? "Sign in to access your energy dashboard" : "Get started with energy monitoring"}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
              <button type="button" onClick={() => { setIsLogin(true); setError(""); }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 ${isLogin ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Login
              </button>
              <button type="button" onClick={() => { setIsLogin(false); setError(""); }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 ${!isLogin ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {!isLogin && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-gray-700 text-sm font-medium">First Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input id="firstName" type="text" placeholder="Prénom"
                        value={firstName} onChange={(e) => setFirstName(e.target.value)}
                        className="pl-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-gray-700 text-sm font-medium">Last Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input id="lastName" type="text" placeholder="Nom"
                        value={lastName} onChange={(e) => setLastName(e.target.value)}
                        className="pl-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg" />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input id="email" type="email" placeholder="example@veam.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required
                    className="pl-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                    onChange={(e) => setPassword(e.target.value)} required
                    className="pl-10 pr-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-500 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              {isLogin && (
                <div className="flex items-center justify-between">
                  {/* Keep me signed in */}
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <div
                      onClick={() => setRememberMe((prev) => !prev)}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                        rememberMe
                          ? "bg-indigo-500 border-indigo-500"
                          : "border-gray-300 group-hover:border-indigo-400"
                      }`}
                    >
                      {rememberMe && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
                      Keep me signed in
                    </span>
                  </label>
                  {/* Forgot password */}
                  <button type="button" onClick={() => setShowForgot(true)}
                    className="text-xs font-medium text-indigo-600 hover:text-purple-600 transition-colors hover:underline">
                    Forgot my password?
                  </button>
                </div>
              )}

              <Button type="submit" disabled={isLoading}
                className="w-full h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg font-medium shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all duration-300 group">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Connecting...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>{isLogin ? "Sign In" : "Create Account"}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-6 animate-in fade-in duration-700 delay-500">
          Visual Energy Analytics & Monitoring v1.0
        </p>
      </div>

      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeForgotModal} />
          <Card className="relative z-10 w-full max-w-sm border-0 shadow-2xl shadow-gray-300/50 animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <CardHeader className="pb-2 relative">
              <button onClick={closeForgotModal} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
              <CardTitle className="text-lg font-semibold text-gray-900">Reset Password</CardTitle>
              <CardDescription className="text-gray-500 text-sm">Enter your email — we'll send you a reset link</CardDescription>
            </CardHeader>
            <CardContent>
              {forgotSent ? (
                <div className="text-center py-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-3">
                    <CheckCircle2 className="w-7 h-7 text-green-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Reset link sent!</p>
                  <p className="text-xs text-gray-500 mt-1">Check your inbox and follow the link to reset your password.</p>
                  <Button onClick={closeForgotModal}
                    className="mt-4 h-10 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-medium shadow-md transition-all duration-300">
                    Back to Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-input" className="text-gray-700 text-sm font-medium">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input id="forgot-input" type="email" placeholder="email@example.com"
                        value={forgotInput} onChange={(e) => setForgotInput(e.target.value)} required
                        className="pl-10 h-11 border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-lg" />
                    </div>
                  </div>

                  {forgotError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <p className="text-xs text-red-600">{forgotError}</p>
                    </div>
                  )}

                  <Button type="submit" disabled={forgotLoading}
                    className="w-full h-11 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-medium shadow-lg transition-all duration-300">
                    {forgotLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4" />
                        <span>Send Reset Link</span>
                      </div>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
