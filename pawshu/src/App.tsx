import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Products from './pages/Products';
import Cart from './pages/Cart';
import Booking from './pages/Booking';
import LostFound from './pages/LostFound';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import ProductManagement from './pages/ProductManagement';
import AdminLogin from './pages/AdminLogin';
import AdminStats from './pages/AdminStats';
import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';
import AdminDoctors from './pages/AdminDoctors';
// Import doctor components
import DoctorLogin from './components/doctor/DoctorLogin';
import DoctorDashboard from './components/doctor/DoctorDashboard';
import DoctorProfile from './components/doctor/DoctorProfile';
import DoctorAppointments from './components/doctor/DoctorAppointments';
import DoctorSidebar from './components/doctor/DoctorSidebar';

// Protected route component for admin routes
const ProtectedAdminRoute = ({ children }: { children: JSX.Element }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if admin is logged in
    const adminToken = localStorage.getItem('adminToken');
    setIsAdmin(!!adminToken);
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" />;
  }

  return children;
};

// Protected route component for doctor routes
const ProtectedDoctorRoute = ({ children }: { children: JSX.Element }) => {
  const [isDoctor, setIsDoctor] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if doctor is logged in
    const doctorToken = localStorage.getItem('doctorToken');
    setIsDoctor(!!doctorToken);
    setLoading(false);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isDoctor) {
    return <Navigate to="/doctor/login" />;
  }

  return children;
};

// Layout component for user routes
const UserLayout = ({ children }: { children: JSX.Element }) => {
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <main>{children}</main>
    </div>
  );
};

// Layout component for doctor routes
const DoctorLayout = ({ children }: { children: JSX.Element }) => {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <DoctorSidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <Routes>
            {/* Admin Login */}
            <Route path="/admin/login" element={<AdminLogin />} />
            
            {/* Protected Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedAdminRoute>
                  <AdminLayout />
                </ProtectedAdminRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="products" element={<ProductManagement />} />
              <Route path="doctors" element={<AdminDoctors />} />
              <Route path="stats" element={<AdminStats />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            
            {/* Doctor Routes */}
            <Route path="/doctor/login" element={<DoctorLogin />} />
            <Route 
              path="/doctor" 
              element={
                <ProtectedDoctorRoute>
                  <DoctorLayout>
                    <DoctorDashboard />
                  </DoctorLayout>
                </ProtectedDoctorRoute>
              } 
            />
            <Route 
              path="/doctor/dashboard" 
              element={
                <ProtectedDoctorRoute>
                  <DoctorLayout>
                    <DoctorDashboard />
                  </DoctorLayout>
                </ProtectedDoctorRoute>
              } 
            />
            <Route 
              path="/doctor/profile" 
              element={
                <ProtectedDoctorRoute>
                  <DoctorLayout>
                    <DoctorProfile />
                  </DoctorLayout>
                </ProtectedDoctorRoute>
              } 
            />
            <Route 
              path="/doctor/appointments" 
              element={
                <ProtectedDoctorRoute>
                  <DoctorLayout>
                    <DoctorAppointments />
                  </DoctorLayout>
                </ProtectedDoctorRoute>
              } 
            />
            
            {/* User Routes */}
            <Route path="/" element={<UserLayout><Home /></UserLayout>} />
            <Route path="/login" element={<UserLayout><Login /></UserLayout>} />
            <Route path="/register" element={<UserLayout><Register /></UserLayout>} />
            <Route path="/profile" element={<UserLayout><Profile /></UserLayout>} />
            <Route path="/products" element={<UserLayout><Products /></UserLayout>} />
            <Route path="/cart" element={<UserLayout><Cart /></UserLayout>} />
            <Route path="/booking" element={<UserLayout><Booking /></UserLayout>} />
            <Route path="/lost-found" element={<UserLayout><LostFound /></UserLayout>} />
            <Route path="/wishlist" element={<UserLayout><Wishlist /></UserLayout>} />
            <Route path="/checkout" element={<UserLayout><Checkout /></UserLayout>} />
          </Routes>
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App; 