import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

export default function Navbar() {
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();
  const nav = useNavigate();

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/50 px-6 py-4 backdrop-blur">
      {/* Left cluster: brand + Chat + Login/Logout */}
      <div className="flex items-center gap-3">
        <div className="text-2xl font-bold text-mil-green cursor-pointer" onClick={() => nav("/")}>
          SurveiLens
        </div>

        <button
          onClick={() => nav("/ask")}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
          aria-label="Open Chat Assistant"
        >
          Chat
        </button>

        {!isAuthenticated ? (
          <button
            onClick={() => loginWithRedirect()}
            className="rounded-xl bg-mil-green px-3 py-1.5 text-sm font-semibold text-black"
          >
            Login
          </button>
        ) : (
          <button
            onClick={() => logout({ returnTo: window.location.origin })}
            className="rounded-xl bg-white/10 px-3 py-1.5 text-sm"
          >
            Logout
          </button>
        )}
      </div>

      {/* Right cluster: quick links for authenticated users */}
      <div className="flex items-center gap-4 text-sm">
        {isAuthenticated && (
          <>
            <Link to="/home" className="hover:text-mil-amber">
              User Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
