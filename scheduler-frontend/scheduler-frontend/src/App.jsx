import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ToastProvider } from "./components/Toast";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Calendar from "./pages/Calendar";
import Bookings from "./pages/Bookings";
import BookingHistory from "./pages/BookingHistory"; // 1. Import it here
import Resources from "./pages/Resources";
import AccountSettings from "./pages/AccountSettings";
import SystemSettings from "./pages/SystemSettings";
import ActivityLogs from "./pages/ActivityLogs";
import Requests from "./pages/Requests";
import VerifyEmailChange from "./pages/VerifyEmailChange";
import GoogleCallback from "./pages/GoogleCallback";
import BarangaySetup from "./pages/BarangaySetup";
import RegistrationStatus from "./pages/RegistrationStatus";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
            <Route index element={<Overview />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="booking-history" element={<BookingHistory />} />{" "}
            {/* 2. Add the route here */}
            <Route path="resources" element={<Resources />} />
            <Route path="requests" element={<Requests />} />
            <Route path="registration-requests" element={<Navigate to="/requests?section=registration" replace />} />
            <Route path="account-settings" element={<AccountSettings />} />
            <Route path="system-settings" element={<SystemSettings />} />
            <Route path="activity-logs" element={<ActivityLogs />} />
            <Route path="booking-removal-requests" element={<Navigate to="/requests?section=removal" replace />} />
          </Route>
          {/* Public routes */}
          <Route path="/verify-email-change" element={<VerifyEmailChange />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />
          <Route path="/barangay-setup" element={<BarangaySetup />} />
          <Route path="/register/barangay" element={<BarangaySetup />} />
          <Route path="/registration-status" element={<RegistrationStatus />} />
          </Routes>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
