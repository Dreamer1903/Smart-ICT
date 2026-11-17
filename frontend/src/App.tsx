import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { Layout } from "@/components/Layout";
import type { UserRole } from "@/lib/types";
import { ACCESS_ROLES, ENROLLMENT_ROLES, homePathFor, NURSE_ROLES, PULSE_ROLES, REPORT_ROLES } from "@/lib/utils";
import { AttendancePage } from "@/pages/AttendancePage";
import { EnrollmentPage } from "@/pages/EnrollmentPage";
import { StudentCardPage } from "@/pages/StudentCardPage";
import { StudentsPage } from "@/pages/StudentsPage";
import { AccessPage } from "@/pages/AccessPage";
import { LoginPage } from "@/pages/LoginPage";
import { NursePage } from "@/pages/NursePage";
import { PulsePage } from "@/pages/PulsePage";

function Guard({ roles, children }: { roles?: UserRole[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="size-6 animate-spin text-indigo-600" /></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useAuth();
  return <Navigate to={user ? homePathFor(user.role) : "/login"} replace />;
}

function Forbidden() {
  return (
    <div className="py-20 text-center text-slate-600">
      Для вашей роли экраны School OS пока не подключены. Обратитесь к администратору.
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Guard><Layout /></Guard>}>
            <Route path="/pulse" element={<Guard roles={PULSE_ROLES}><PulsePage /></Guard>} />
            <Route path="/enrollment" element={<Guard roles={ENROLLMENT_ROLES}><EnrollmentPage /></Guard>} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/students/:id" element={<StudentCardPage />} />
            <Route path="/attendance" element={<Guard roles={REPORT_ROLES}><AttendancePage /></Guard>} />
            <Route path="/access" element={<Guard roles={ACCESS_ROLES}><AccessPage /></Guard>} />
            <Route path="/nurse" element={<Guard roles={NURSE_ROLES}><NursePage /></Guard>} />
            <Route path="/forbidden" element={<Forbidden />} />
          </Route>
          <Route path="*" element={<Guard><Home /></Guard>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
