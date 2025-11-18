import { BrowserRouter as Router, Routes, Route, Link, Navigate } from "react-router-dom";
import Ranking from "./Ranking"; // 📦 Composant Ranking
import VERSUS from "./VERSUS";   // 📦 Composant Versus
import Users from "./Users";     // 📦 Composant Users

function App() {
  return (
    <Router>
      {/* 🧭 Navbar principale */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between w-[90%] sm:w-[70%] px-6 py-3 bg-black/60 
      border border-violet-700/30 rounded-2xl shadow-[0_0_25px_rgba(150,100,255,0.3)] backdrop-blur-md">
        
        {/* 🔹 Logo / Lien principal */}
        <div className="flex-1 flex justify-start">
          <Link
            to="/ranking"
            className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-violet-400 to-violet-600 tracking-widest 
            hover:scale-105 transition-all duration-300"
            >LE CLASSEMENT
          </Link>
        </div>

        {/* 🔹 Liens de navigation */}
        <div className="flex gap-6 justify-end">
          <Link
            to="/ranking"
            className="text-sm sm:text-base text-violet-300 hover:text-white hover:drop-shadow-[0_0_10px_#a78bfa] transition-all duration-300"
          >RANKING
          </Link>


          <Link
            to="/versus"
            className="text-sm sm:text-base text-violet-300 hover:text-white hover:drop-shadow-[0_0_10px_#a78bfa] transition-all duration-300"
          >VERSUS
          </Link>
          
        </div>
      </div>

      {/* ✨ Routes principales */}
      <div className="pt-24">
        <Routes>
          {/* 🔄 Redirection automatique de "/" vers "/ranking" */}
          <Route path="/" element={<Navigate to="/ranking" replace />} />

          {/* 📊 Route pour le classement */}
          <Route path="/ranking" element={<Ranking />} />

          {/* ⚔ Route pour le mode Versus */}
          <Route path="/versus" element={<VERSUS />} />

          {/* Page profil dynamique */}
          <Route path="/users/:name" element={<Users />} />    
        </Routes>
      </div>
    </Router>
  );
}

export default App;
