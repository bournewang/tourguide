import React from 'react';
import locations from '../data/locations.json';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  const handleCitySelect = (cityId) => {
    navigate(`/city/${cityId}`);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <h1 className="text-3xl font-extrabold text-center text-indigo-700 mb-12 tracking-tight">
          探索城市
        </h1>
        {locations.map((province) => (
          <div key={province.province_id} className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">
              {province.province}
            </h2>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {province.cities.map((city) => (
                <div
                  key={city.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 ease-in-out cursor-pointer flex items-center justify-center h-24"
                  onClick={() => handleCitySelect(city.id)}
                >
                  <div className="p-4">
                    <h3 className="text-lg font-bold text-gray-800">
                      {city.name}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
