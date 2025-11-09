import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import UserHome from "./pages/UserHome";
import ServerCreate from "./pages/ServerCreate";
import ServerAnalyze from "./pages/ServerAnalyze";
import Reports from "./pages/Reports";
import ReviewQueue from "./pages/ReviewQueue";
import Audit from "./pages/Audit";
import Policy from "./pages/Policy";
import Ask from "./pages/Ask";

export default function RoutesView() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<UserHome />} />
      <Route path="/servers/new" element={<ServerCreate />} />

      {/* Server-scoped routes */}
      <Route path="/servers/:id/analyze" element={<ServerAnalyze />} />
      <Route path="/servers/:id/reports" element={<Reports />} />
      <Route path="/servers/:id/review" element={<ReviewQueue />} />
      <Route path="/servers/:id/audit" element={<Audit />} />
      <Route path="/servers/:id/policy" element={<Policy />} />

      {/* Global chat */}
      <Route path="/ask" element={<Ask />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
