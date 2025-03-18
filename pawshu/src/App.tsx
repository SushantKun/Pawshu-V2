import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Products from './pages/Products';
import Cart from './pages/Cart';
import Booking from './pages/Booking';
import LostFound from './pages/LostFound';
import Donate from './pages/Donate';
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
import CharityManagement from './components/admin/CharityManagement';
// Import doctor components
import DoctorLogin from './components/doctor/DoctorLogin';
import DoctorDashboard from './components/doctor/DoctorDashboard';
import DoctorProfile from './components/doctor/DoctorProfile';
import DoctorAppointments from './components/doctor/DoctorAppointments';
import DoctorSidebar from './components/doctor/DoctorSidebar';
import Doctors from './pages/Doctors';

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
const UserLayout = ({ children, showFooter = true }: { children: JSX.Element, showFooter?: boolean }) => {
  const { darkMode } = useTheme();
  
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <Navbar />
      <main className="min-h-screen">{children}</main>
      {showFooter && <Footer />}
    </div>
  );
};

// Layout component for doctor routes
const DoctorLayout = ({ children }: { children: JSX.Element }) => {
  const { darkMode } = useTheme();
  
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);
  
  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
      <DoctorSidebar />
      <div className="flex-1">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <ThemeProvider>
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
                <Route path="charities" element={<CharityManagement />} />
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
              <Route path="/login" element={<UserLayout showFooter={false}><Login /></UserLayout>} />
              <Route path="/register" element={<UserLayout showFooter={false}><Register /></UserLayout>} />
              <Route path="/profile" element={<UserLayout><Profile /></UserLayout>} />
              <Route path="/products" element={<UserLayout><Products /></UserLayout>} />
              <Route path="/cart" element={<UserLayout><Cart /></UserLayout>} />
              <Route path="/booking" element={<UserLayout showFooter={false}><Booking /></UserLayout>} />
              <Route path="/lost-found" element={<UserLayout><LostFound /></UserLayout>} />
              <Route path="/donate" element={<UserLayout><Donate /></UserLayout>} />
              <Route path="/doctors" element={<UserLayout><Doctors /></UserLayout>} />
              <Route path="/wishlist" element={<UserLayout><Wishlist /></UserLayout>} />
              <Route path="/checkout" element={<UserLayout><Checkout /></UserLayout>} />
            </Routes>
          </Router>
        </ThemeProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App; 