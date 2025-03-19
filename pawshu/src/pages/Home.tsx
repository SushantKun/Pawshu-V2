import { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { 
  ArrowRightIcon, 
  ShoppingBagIcon, 
  HeartIcon, 
  UserGroupIcon,
  ChevronDownIcon 
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import './Home.css';

// Define hero images
const PlaceholderImage = '/placeholder.svg';
const heroImages = [
  '/heroimg1.jpg',
  '/heroimg2.jpg',
  '/heroimg3.jpg',
  '/heroimg4.jpg',
  '/heroimg5.jpg',
  '/heroimg6.jpg'
];

// Type cast icon components to fix TypeScript errors
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
const ArrowRightIconComponent = ArrowRightIcon as IconComponent;
const ShoppingBagIconComponent = ShoppingBagIcon as IconComponent;
const HeartIconComponent = HeartIcon as IconComponent;
const UserGroupIconComponent = UserGroupIcon as IconComponent;
const ChevronDownIconComponent = ChevronDownIcon as IconComponent;

interface Product {
  _id: string;
  name: string;
  price: number;
  description: string;
  images: { url: string }[];
}

interface Doctor {
  _id: string;
  firstName: string;
  lastName: string;
  specialization: string;
  bio: string;
  profile?: {
    url: string;
  } | string;
  profileImage?: {
    url: string;
  };
  experience?: number;
}

interface Charity {
  _id: string;
  name: string;
  description: string;
  image: {
    url: string;
  };
  goal: number;
  raised: number;
}

const API_URL = 'http://localhost:5000/api';

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [charities, setCharities] = useState<Charity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [currentHeroImage, setCurrentHeroImage] = useState(0);

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        const response = await axios.get(`${API_URL}/products/featured`);
        setFeaturedProducts(response.data);
      } catch (err) {
        setError('Failed to fetch featured products');
        console.error('Error fetching featured products:', err);
      } finally {
        setLoading(false);
      }
    };

    const fetchDoctors = async () => {
      try {
        const response = await axios.get(`${API_URL}/doctors`);
        console.log('Doctor data from API:', response.data);
        setDoctors(response.data.slice(0, 4)); // Get first 4 doctors
      } catch (err) {
        console.error('Error fetching doctors:', err);
      }
    };

    const fetchCharities = async () => {
      try {
        const response = await axios.get(`${API_URL}/charities`);
        setCharities(response.data);
      } catch (err) {
        console.error('Error fetching charities:', err);
      }
    };

    fetchFeaturedProducts();
    fetchDoctors();
    fetchCharities();
  }, []);

  // Hero image slideshow effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroImage((prev) => (prev + 1) % heroImages.length);
    }, 3000); // Change image every 3 seconds
    
    return () => clearInterval(interval);
  }, []);

  const handleImageError = (productId: string) => {
    setImageErrors(prev => ({
      ...prev,
      [productId]: true
    }));
  };

  const getProductImage = (product: Product): string => {
    if (product.images && 
        product.images.length > 0 && 
        product.images[0].url && 
        !imageErrors[product._id]) {
      return product.images[0].url;
    }
    return PlaceholderImage;
  };

  const scrollToProducts = () => {
    const productsSection = document.querySelector('.featured-products');
    if (productsSection) {
      productsSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="home-page bg-white dark:bg-gray-900">
      {/* Hero Section 1 */}
      <section className="hero-section" style={{ background: 'linear-gradient(to bottom, #19E622, rgba(25, 230, 34, 0.7))' }}>
        <div className="hero-content container mx-auto px-4 h-full flex items-center justify-center">
          {/* Left side content */}
          <div className="w-full lg:w-1/2 z-10 lg:pr-12 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Everything Your Pet Needs in One Place
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Discover premium products, quality healthcare, and essential services for your furry friends.
            </p>
            <div className="flex justify-center lg:justify-start">
              <Link 
                to="/products" 
                className="px-6 py-3 bg-white text-indigo-600 rounded-md font-medium hover:bg-gray-100 transition-colors duration-200 inline-flex items-center"
              >
                Shop Now
                <ShoppingBagIconComponent className="w-5 h-5 ml-2" />
              </Link>
            </div>
          </div>

          {/* Right side image slideshow */}
          <div className="hidden lg:block w-1/2 h-full relative lg:pl-12">
            <div className="absolute right-12 top-1/2 -translate-y-1/3">
              <div className="relative w-[500px] h-[400px] perspective-[2000px]">
                {heroImages.map((img, index) => {
                  // Calculate the position of each image relative to the current image
                  const position = (index - currentHeroImage + heroImages.length) % heroImages.length;
                  // Calculate the z-index to ensure proper stacking
                  const zIndex = position === 0 ? heroImages.length : heroImages.length - position;
                  
                  // Define transformations based on position
                  let transform = '';
                  let opacity = 1;
                  let scale = 1;
                  
                  if (position === 0) {
                    // Current image - lifted up and forward
                    transform = 'translateX(0) translateZ(100px) translateY(-20px) rotateX(5deg)';
                    scale = 1;
                  } else if (position === heroImages.length - 1) {
                    // Next image - subtle peek from behind on the right
                    transform = 'translateX(15%) translateZ(-50px) translateY(0) rotateY(-5deg)';
                    opacity = 0.15;
                    scale = 0.95;
                  } else if (position === 1) {
                    // Previous image - subtle peek from behind on the left
                    transform = 'translateX(-15%) translateZ(-50px) translateY(0) rotateY(5deg)';
                    opacity = 0.15;
                    scale = 0.95;
                  } else {
                    // Other images - hidden behind
                    transform = 'translateZ(-200px)';
                    opacity = 0;
                    scale = 0.9;
                  }

                  return (
                    <div
                      key={img}
                      className="absolute inset-0 rounded-lg overflow-hidden shadow-2xl transition-all duration-1000 ease-in-out"
                      style={{
                        opacity,
                        zIndex,
                        transformStyle: 'preserve-3d',
                        backfaceVisibility: 'hidden',
                        transform: `${transform} scale(${scale})`,
                        boxShadow: position === 0 
                          ? '0 20px 40px rgba(0,0,0,0.3)' 
                          : '0 10px 20px rgba(0,0,0,0.2)',
                      }}
                    >
                      <img 
                        src={img} 
                        alt={`Hero ${index + 1}`}
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = PlaceholderImage;
                        }}
                      />
                      {/* Add a subtle gradient overlay */}
                      <div className={`absolute inset-0 ${
                        position === 0 
                          ? 'bg-gradient-to-r from-black/10 to-transparent' 
                          : 'bg-gradient-to-r from-black/30 to-transparent'
                      }`}></div>
                    </div>
                  );
                })}
              </div>
              
              {/* Navigation dots */}
              <div className="flex justify-center gap-2 mt-8">
                {heroImages.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === currentHeroImage 
                        ? 'bg-white scale-125' 
                        : 'bg-white/50 hover:bg-white/75'
                    }`}
                    onClick={() => setCurrentHeroImage(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Add scroll indicator with click handler */}
        <div className="scroll-indicator" onClick={scrollToProducts}>
          <ChevronDownIconComponent className="w-8 h-8 text-white animate-bounce" />
        </div>
      </section>

      {/* Hero Section 2 */}
      <section className="hero-section" style={{ background: 'linear-gradient(to bottom, rgba(34, 25, 230, 0.7), #2219E6)' }}>
        <div className="hero-content container mx-auto px-4 h-full flex items-center justify-center">
          {/* Left side image slideshow */}
          <div className="hidden lg:block w-1/2 h-full relative order-1 lg:pr-24">
            <div className="absolute left-12 top-1/2 -translate-y-1/3">
              <div className="relative w-[500px] h-[400px] perspective-[2000px]">
                {heroImages.map((img, index) => {
                  // Calculate the position slightly differently to create variety
                  const position = (index - ((currentHeroImage + 3) % heroImages.length) + heroImages.length) % heroImages.length;
                  // Calculate the z-index to ensure proper stacking
                  const zIndex = position === 0 ? heroImages.length : heroImages.length - position;
                  
                  // Define transformations based on position
                  let transform = '';
                  let opacity = 1;
                  let scale = 1;
                  
                  if (position === 0) {
                    // Current image - lifted up and forward
                    transform = 'translateX(0) translateZ(100px) translateY(-20px) rotateX(5deg)';
                    scale = 1;
                  } else if (position === heroImages.length - 1) {
                    // Next image - subtle peek from behind on the left (reversed)
                    transform = 'translateX(-15%) translateZ(-50px) translateY(0) rotateY(5deg)';
                    opacity = 0.15;
                    scale = 0.95;
                  } else if (position === 1) {
                    // Previous image - subtle peek from behind on the right (reversed)
                    transform = 'translateX(15%) translateZ(-50px) translateY(0) rotateY(-5deg)';
                    opacity = 0.15;
                    scale = 0.95;
                  } else {
                    // Other images - hidden behind
                    transform = 'translateZ(-200px)';
                    opacity = 0;
                    scale = 0.9;
                  }

                  return (
                    <div
                      key={`second-${img}`}
                      className="absolute inset-0 rounded-lg overflow-hidden shadow-2xl transition-all duration-1000 ease-in-out"
                      style={{
                        opacity,
                        zIndex,
                        transformStyle: 'preserve-3d',
                        backfaceVisibility: 'hidden',
                        transform: `${transform} scale(${scale})`,
                        boxShadow: position === 0 
                          ? '0 20px 40px rgba(0,0,0,0.3)' 
                          : '0 10px 20px rgba(0,0,0,0.2)',
                      }}
                    >
                      <img 
                        src={img} 
                        alt={`Second Hero ${index + 1}`}
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = PlaceholderImage;
                        }}
                      />
                      {/* Add a subtle gradient overlay */}
                      <div className={`absolute inset-0 ${
                        position === 0 
                          ? 'bg-gradient-to-l from-black/10 to-transparent' // Flip gradient direction 
                          : 'bg-gradient-to-l from-black/30 to-transparent'
                      }`}></div>
                    </div>
                  );
                })}
              </div>
              
              {/* Navigation dots */}
              <div className="flex justify-center gap-2 mt-8">
                {heroImages.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      (index + 3) % heroImages.length === currentHeroImage
                        ? 'bg-white scale-125' 
                        : 'bg-white/50 hover:bg-white/75'
                    }`}
                    onClick={() => setCurrentHeroImage((index + 3) % heroImages.length)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right side content */}
          <div className="w-full lg:w-1/2 z-10 order-2 lg:pl-24 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              More Than Just a Pet Store
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Book veterinary services, help find lost pets, and support animal welfare through donations.
            </p>
            <div className="flex justify-center lg:justify-start">
              <Link 
                to="/booking" 
                className="px-6 py-3 bg-white text-indigo-600 rounded-md font-medium hover:bg-gray-100 transition-colors duration-200 inline-flex items-center"
              >
                Book Appointment
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Hero Section 3 */}
      <section className="hero-section" style={{ background: 'linear-gradient(to bottom, rgba(230, 34, 25, 0.7), #E62219)' }}>
        <div className="hero-content container mx-auto px-4 h-full flex items-center justify-center">
          {/* Left side content */}
          <div className="w-full lg:w-1/2 z-10 lg:pr-24 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
              Lost & Found and Donations
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Help reunite lost pets with their owners and support animal welfare organizations.
            </p>
            <div className="flex flex-wrap justify-center lg:justify-start gap-4">
              <Link 
                to="/lost-found" 
                className="px-6 py-3 bg-white text-indigo-600 rounded-md font-medium hover:bg-gray-100 transition-colors duration-200"
              >
                Lost & Found
              </Link>
              <Link 
                to="/donate" 
                className="px-6 py-3 bg-white text-indigo-600 rounded-md font-medium hover:bg-gray-100 transition-colors duration-200"
              >
                Donate
              </Link>
            </div>
          </div>

          {/* Right side image slideshow */}
          <div className="hidden lg:block w-1/2 h-full relative lg:pl-24">
            <div className="absolute right-12 top-1/2 -translate-y-1/3">
              <div className="relative w-[500px] h-[400px] perspective-[2000px]">
                {heroImages.map((img, index) => {
                  // Calculate the position of each image relative to the current image
                  const position = (index - ((currentHeroImage + 6) % heroImages.length) + heroImages.length) % heroImages.length;
                  // Calculate the z-index to ensure proper stacking
                  const zIndex = position === 0 ? heroImages.length : heroImages.length - position;
                  
                  // Define transformations based on position
                  let transform = '';
                  let opacity = 1;
                  let scale = 1;
                  
                  if (position === 0) {
                    // Current image - lifted up and forward
                    transform = 'translateX(0) translateZ(100px) translateY(-20px) rotateX(5deg)';
                    scale = 1;
                  } else if (position === heroImages.length - 1) {
                    // Next image - subtle peek from behind on the right
                    transform = 'translateX(15%) translateZ(-50px) translateY(0) rotateY(-5deg)';
                    opacity = 0.15;
                    scale = 0.95;
                  } else if (position === 1) {
                    // Previous image - subtle peek from behind on the left
                    transform = 'translateX(-15%) translateZ(-50px) translateY(0) rotateY(5deg)';
                    opacity = 0.15;
                    scale = 0.95;
                  } else {
                    // Other images - hidden behind
                    transform = 'translateZ(-200px)';
                    opacity = 0;
                    scale = 0.9;
                  }

                  return (
                    <div
                      key={`third-${img}`}
                      className="absolute inset-0 rounded-lg overflow-hidden shadow-2xl transition-all duration-1000 ease-in-out"
                      style={{
                        opacity,
                        zIndex,
                        transformStyle: 'preserve-3d',
                        backfaceVisibility: 'hidden',
                        transform: `${transform} scale(${scale})`,
                        boxShadow: position === 0 
                          ? '0 20px 40px rgba(0,0,0,0.3)' 
                          : '0 10px 20px rgba(0,0,0,0.2)',
                      }}
                    >
                      <img 
                        src={img} 
                        alt={`Third Hero ${index + 1}`}
                        className="w-full h-full object-cover object-center"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null;
                          target.src = PlaceholderImage;
                        }}
                      />
                      {/* Add a subtle gradient overlay */}
                      <div className={`absolute inset-0 ${
                        position === 0 
                          ? 'bg-gradient-to-r from-black/10 to-transparent' 
                          : 'bg-gradient-to-r from-black/30 to-transparent'
                      }`}></div>
                    </div>
                  );
                })}
              </div>
              
              {/* Navigation dots */}
              <div className="flex justify-center gap-2 mt-8">
                {heroImages.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      (index + 6) % heroImages.length === currentHeroImage
                        ? 'bg-white scale-125' 
                        : 'bg-white/50 hover:bg-white/75'
                    }`}
                    onClick={() => setCurrentHeroImage((index + 6) % heroImages.length)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Section */}
      <section className="featured-products py-16 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Featured Products</h2>
            <Link 
              to="/products" 
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center font-medium"
            >
              View All
              <ArrowRightIconComponent className="w-4 h-4 ml-1" />
            </Link>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 dark:border-blue-400"></div>
            </div>
          ) : error ? (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
              {error}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {featuredProducts.map(product => (
                <div key={product._id} className="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:scale-105">
                  <div className="h-56 overflow-hidden">
                    <img 
                      src={getProductImage(product)} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                      onError={() => handleImageError(product._id)}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{product.name}</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">NPR {product.price.toLocaleString('ne-NP')}</p>
                    <Link 
                      to="/products" 
                      className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
                    >
                      View Product
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Our Veterinarians Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Our Veterinarians</h2>
            <Link 
              to="/doctors" 
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center font-medium"
            >
              View All
              <ArrowRightIconComponent className="w-4 h-4 ml-1" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {doctors.map(doctor => {
              console.log('Rendering doctor:', doctor._id, doctor);
              
              // Try different possible image sources
              const imageUrl = typeof doctor.profile === 'object' && doctor.profile?.url ? 
                              doctor.profile.url : 
                              doctor.profileImage?.url || 
                              (typeof doctor.profile === 'string' ? doctor.profile : null) || 
                              PlaceholderImage;
                               
              return (
                <div key={doctor._id} className="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:scale-105">
                  <div className="h-56 overflow-hidden bg-gray-200 dark:bg-gray-600">
                    <img 
                      src={imageUrl}
                      alt={`Dr. ${doctor.firstName} ${doctor.lastName}`} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.log(`Image error for doctor ${doctor._id}:`, e);
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = PlaceholderImage;
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Dr. {doctor.firstName} {doctor.lastName}</h3>
                    <p className="text-gray-600 dark:text-gray-300 mb-2">{doctor.specialization}</p>
                    {doctor.experience && (
                      <p className="text-gray-600 dark:text-gray-300 mb-2">{doctor.experience} years experience</p>
                    )}
                    <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{doctor.bio}</p>
                    <Link 
                      to={`/booking?doctor=${doctor._id}`} 
                      className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
                    >
                      Book Appointment
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Charities Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Support Our Causes</h2>
            <Link 
              to="/donate" 
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 inline-flex items-center font-medium"
            >
              View All
              <ArrowRightIconComponent className="w-4 h-4 ml-1" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {charities.map(charity => (
              <div key={charity._id} className="bg-white dark:bg-gray-700 rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:scale-105">
                <div className="h-56 overflow-hidden">
                  <img 
                    src={charity.image?.url || PlaceholderImage} 
                    alt={charity.name} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = PlaceholderImage;
                    }}
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{charity.name}</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{charity.description}</p>
                  
                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        NPR {charity.raised.toLocaleString('ne-NP')} raised
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        of NPR {charity.goal.toLocaleString('ne-NP')}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5">
                      <div 
                        className="bg-green-600 h-2.5 rounded-full" 
                        style={{ width: `${Math.min(100, (charity.raised / charity.goal) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <Link 
                    to="/donate" 
                    className="block w-full text-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors duration-200"
                  >
                    Donate Now
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">Why Choose Us?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-md text-center transition-transform duration-300 hover:scale-105">
              <div className="bg-blue-100 dark:bg-blue-900/30 inline-block p-3 rounded-full mb-4">
                <ShoppingBagIconComponent className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Premium Products</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Carefully curated selection of high-quality pet products for all your needs.
              </p>
            </div>
            
            <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-md text-center transition-transform duration-300 hover:scale-105">
              <div className="bg-blue-100 dark:bg-blue-900/30 inline-block p-3 rounded-full mb-4">
                <HeartIconComponent className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Expert Care</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Professional veterinarians and pet specialists dedicated to your pet's wellbeing.
              </p>
            </div>
            
            <div className="p-6 bg-white dark:bg-gray-700 rounded-lg shadow-md text-center transition-transform duration-300 hover:scale-105">
              <div className="bg-blue-100 dark:bg-blue-900/30 inline-block p-3 rounded-full mb-4">
                <UserGroupIconComponent className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-white">Customer Support</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Friendly and knowledgeable support team ready to assist you with any concerns.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home; 