import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface PetReport {
  id: number;
  type: 'lost' | 'found';
  petType: string;
  breed?: string;
  location: string;
  date: string;
  description: string;
  image: string;
  contact: string;
}

const SAMPLE_REPORTS: PetReport[] = [
  {
    id: 1,
    type: 'lost',
    petType: 'Dog',
    breed: 'Golden Retriever',
    location: 'Central Park',
    date: '2024-03-14',
    description: 'Yellow collar, answers to Max',
    image: 'https://placehold.co/300x300',
    contact: 'john@example.com'
  },
  {
    id: 2,
    type: 'found',
    petType: 'Cat',
    breed: 'Tabby',
    location: 'Main Street',
    date: '2024-03-13',
    description: 'Friendly cat with blue collar',
    image: 'https://placehold.co/300x300',
    contact: 'jane@example.com'
  }
];

const LostFound = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'browse' | 'report'>('browse');
  const [filter, setFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [formData, setFormData] = useState({
    type: 'lost',
    petType: '',
    breed: '',
    location: '',
    date: '',
    description: '',
    image: '',
    contact: user?.email || ''
  });

  const filteredReports = SAMPLE_REPORTS.filter(report => 
    filter === 'all' || report.type === filter
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement report submission
    console.log('Report submitted:', formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Lost & Found Pets</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Help reunite lost pets with their families</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-8">
          <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-6 py-2 ${
                activeTab === 'browse'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Browse Reports
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-6 py-2 ${
                activeTab === 'report'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              Submit Report
            </button>
          </div>
        </div>

        {activeTab === 'browse' ? (
          <>
            {/* Filters */}
            <div className="mb-6 flex justify-center space-x-4">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('lost')}
                className={`px-4 py-2 rounded-md ${
                  filter === 'lost'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Lost Pets
              </button>
              <button
                onClick={() => setFilter('found')}
                className={`px-4 py-2 rounded-md ${
                  filter === 'found'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Found Pets
              </button>
            </div>

            {/* Reports Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredReports.map(report => (
                <div key={report.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                  <img
                    src={report.image}
                    alt={`${report.type} ${report.petType}`}
                    className="w-full h-[300px] object-cover"
                  />
                  <div className="p-4">
                    <div className={`inline-block px-2 py-1 rounded text-sm font-semibold ${
                      report.type === 'lost'
                        ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300'
                        : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300'
                    }`}>
                      {report.type.toUpperCase()}
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                      {report.petType} - {report.breed}
                    </h3>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">{report.description}</p>
                    <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                      <p>Location: {report.location}</p>
                      <p>Date: {report.date}</p>
                      <p>Contact: {report.contact}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Report Form */
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Report Type
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="lost">Lost Pet</option>
                    <option value="found">Found Pet</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pet Type
                    </label>
                    <input
                      type="text"
                      name="petType"
                      value={formData.petType}
                      onChange={handleChange}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Breed (optional)
                    </label>
                    <input
                      type="text"
                      name="breed"
                      value={formData.breed}
                      onChange={handleChange}
                      className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={4}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Contact Information
                  </label>
                  <input
                    type="email"
                    name="contact"
                    value={formData.contact}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-500 transition-colors"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LostFound; 