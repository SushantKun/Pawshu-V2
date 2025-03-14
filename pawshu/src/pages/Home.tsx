import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative bg-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-6">
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-6xl">
                Welcome to Pawshu
              </h1>
              <p className="mt-6 text-xl">
                Your one-stop destination for all your pet needs. From food to toys, we've got everything to keep your furry friends happy and healthy.
              </p>
              <div className="mt-8 flex space-x-4">
                <Link
                  to="/products"
                  className="inline-block bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                >
                  Shop Now
                </Link>
                <Link
                  to="/booking"
                  className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-400 transition-colors"
                >
                  Book Services
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Pet Products</h3>
              <p className="mt-2 text-gray-600">Quality food, toys, and accessories for your pets.</p>
              <Link to="/products" className="mt-4 text-blue-600 hover:text-blue-500 block">
                Browse Products →
              </Link>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Lost & Found</h3>
              <p className="mt-2 text-gray-600">Help reunite lost pets with their families.</p>
              <Link to="/lost-found" className="mt-4 text-blue-600 hover:text-blue-500 block">
                Learn More →
              </Link>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Pet Services</h3>
              <p className="mt-2 text-gray-600">Professional grooming and veterinary services.</p>
              <Link to="/booking" className="mt-4 text-blue-600 hover:text-blue-500 block">
                Book Now →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Donation Banner */}
      <div className="bg-blue-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">Support Animal Shelters</h2>
            <p className="mt-4 text-lg text-gray-600">
              Help us make a difference in the lives of animals in need.
            </p>
            <Link
              to="/donation"
              className="mt-6 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-500 transition-colors"
            >
              Donate Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home; 