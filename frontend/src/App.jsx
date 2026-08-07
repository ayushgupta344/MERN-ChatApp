import { ThemeProvider } from "./context/ThemeContext";
import { WallpaperProvider } from "./context/WallpaperContext";
import { Routes, Route,Navigate } from "react-router-dom";
import { useAuth } from "@clerk/react";
import  ChatPage  from "./pages/ChatPage";
import AuthPage  from "./pages/AuthPage";
import PageLoader from "./components/PageLoader";
import { useAuthStore } from "./store/useAuthStore";
import { Toast } from "react-hot-toast";
function App() {
  const { isSignedIn, isLoaded } = useAuth();
   const clearAuth = useAuthStore((state) => state.clearAuth);
   const checkAuth = useAuthStore((state) => state.checkAuth);
   const isCheckingAuth = useAuthStore((state) => state.isCheckingAuth);

   useEffect(() => {
     if (!isLoaded) return;

     if (isSignedIn) checkAuth();
     else clearAuth();
   }, [checkAuth, clearAuth, isLoaded, isSignedIn]);

   if (!isLoaded || (isSignedIn && isCheckingAuth)) return <PageLoader />;

  return (
    <ThemeProvider>
      <WallpaperProvider>
        <Routes>
          <Route
            path="/"
            element={
              isSignedIn ? <ChatPage /> : <Navigate to={"/auth"} replace />
            }
          />
          <Route
            path="/auth"
            element={!isSignedIn ? <AuthPage /> : <Navigate to={"/"} replace />}
          />
        </Routes>
        <Toast/>
      </WallpaperProvider>
    </ThemeProvider>
  );
}

export default App;
