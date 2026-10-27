import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Calendar from "./pages/Calendar";
import Bookings from "./pages/Bookings";
import BookingHistory from "./pages/BookingHistory"; // 1. Import it here
import Resources from "./pages/Resources";
import RegistrationRequests from "./pages/RegistrationRequests";
import AccountSettings from "./pages/AccountSettings";
import VerifyEmailChange from "./pages/VerifyEmailChange";
import GoogleCallback from "./pages/GoogleCallback";
import BarangaySetup from "./pages/BarangaySetup";
import RegistrationStatus from "./pages/RegistrationStatus";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
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
            <Route path="registrations" element={<RegistrationRequests />} />
            <Route path="account-settings" element={<AccountSettings />} />
          </Route>
          {/* Public routes */}
          <Route path="/verify-email-change" element={<VerifyEmailChange />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />
          <Route path="/barangay-setup" element={<BarangaySetup />} />
          <Route path="/register/barangay" element={<BarangaySetup />} />
          <Route path="/registration-status" element={<RegistrationStatus />} />
          </Routes>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
