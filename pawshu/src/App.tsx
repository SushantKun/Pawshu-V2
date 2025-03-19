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
import AdminDashboard from './pages/admin/AdminDashboard';
import ProductManagement from './pages/admin/ProductManagement';
import AdminLogin from './pages/admin/AdminLogin';
import AdminStats from './pages/admin/AdminStats';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSettings from './pages/admin/AdminSettings';
import AdminDoctors from './pages/admin/AdminDoctors';
import CharityManagement from './pages/admin/CharityManagement';
// Import doctor components
import DoctorLogin from './components/doctor/DoctorLogin';
import DoctorDashboard from './components/doctor/DoctorDashboard';
import DoctorProfile from './components/doctor/DoctorProfile';
import DoctorAppointments from './components/doctor/DoctorAppointments';
import DoctorSidebar from './components/doctor/DoctorSidebar';
import Doctors from './pages/Doctors';
import Chat from './pages/Chat';
import AdminSidebar from './components/admin/AdminSidebar';

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
    return (
      <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
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
    return (
      <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
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
      <div className="w-64 flex-shrink-0">
        <DoctorSidebar />
      </div>
      <div className="flex-1 overflow-x-hidden">
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
};

// Layout component for admin routes
const AdminLayout = ({ children }: { children: JSX.Element }) => {
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
      <AdminSidebar />
      <div className="ml-64 p-6 overflow-x-hidden min-h-screen">
        {children}
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <CartProvider>
          <Router>
            <Routes>
              {/* Admin Routes */}
              <Route path="/admin/login" element={
                <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
                  <AdminLogin />
                </div>
              } />
              
              {/* Protected Admin Routes */}
              <Route path="/admin" element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/dashboard" element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/products" element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <ProductManagement />
                  </AdminLayout>
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/statistics" element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminStats />
                  </AdminLayout>
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/users" element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminUsers />
                  </AdminLayout>
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/doctors" element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminDoctors />
                  </AdminLayout>
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/settings" element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <AdminSettings />
                  </AdminLayout>
                </ProtectedAdminRoute>
              } />
              <Route path="/admin/charities" element={
                <ProtectedAdminRoute>
                  <AdminLayout>
                    <CharityManagement />
                  </AdminLayout>
                </ProtectedAdminRoute>
              } />

              {/* Doctor Routes */}
              <Route path="/doctor/login" element={
                <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white">
                  <DoctorLogin />
                </div>
              } />
              <Route path="/doctor" element={
                <ProtectedDoctorRoute>
                  <DoctorLayout>
                    <DoctorDashboard />
                  </DoctorLayout>
                </ProtectedDoctorRoute>
              } />
              <Route path="/doctor/dashboard" element={
                <ProtectedDoctorRoute>
                  <DoctorLayout>
                    <DoctorDashboard />
                  </DoctorLayout>
                </ProtectedDoctorRoute>
              } />
              <Route path="/doctor/appointments" element={
                <ProtectedDoctorRoute>
                  <DoctorLayout>
                    <DoctorAppointments />
                  </DoctorLayout>
                </ProtectedDoctorRoute>
              } />
              <Route path="/doctor/profile" element={
                <ProtectedDoctorRoute>
                  <DoctorLayout>
                    <DoctorProfile />
                  </DoctorLayout>
                </ProtectedDoctorRoute>
              } />
              
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
              <Route path="/chat/*" element={<UserLayout><Chat /></UserLayout>} />
            </Routes>
          </Router>
        </CartProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App; 