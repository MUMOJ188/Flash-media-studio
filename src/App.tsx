import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ClientDashboard from "./pages/ClientDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ClientJobs from "./pages/ClientJobs";
import ClientOrderTracking from "./pages/ClientOrderTracking";
import AdminJobManagement from "./pages/AdminJobManagement";
import StaffLogRequest from "./pages/StaffLogRequest";
import ClientManagement from "./pages/ClientManagement";
import Settings from "./pages/Settings";
import SiteHeader from "./components/layout/SiteHeader";
import AuthGuard from "./components/AuthGuard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SiteHeader />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthGuard requireAuth={false}><Auth /></AuthGuard>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/client" element={<AuthGuard requireAuth={false}><Auth /></AuthGuard>} />
            <Route path="/client/dashboard" element={<AuthGuard><ClientDashboard /></AuthGuard>} />
            <Route path="/client/jobs" element={<AuthGuard><ClientJobs /></AuthGuard>} />
            <Route path="/client/track-orders" element={<AuthGuard><ClientOrderTracking /></AuthGuard>} />
            <Route path="/admin" element={<AuthGuard requireAuth={false}><Auth /></AuthGuard>} />
            <Route path="/admin/dashboard" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
            <Route path="/staff" element={<AuthGuard requireAuth={false}><Auth /></AuthGuard>} />
            <Route path="/staff/dashboard" element={<AuthGuard><AdminDashboard /></AuthGuard>} />
            <Route path="/staff/log-request" element={<AuthGuard><StaffLogRequest /></AuthGuard>} />
            <Route path="/staff/manage-jobs" element={<AuthGuard><AdminJobManagement /></AuthGuard>} />
            <Route path="/staff/clients" element={<AuthGuard><ClientManagement /></AuthGuard>} />
            <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
