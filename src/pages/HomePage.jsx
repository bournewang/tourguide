import React from 'react';
import locations from '../data/locations.json';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  const handleCitySelect = (cityId) => {
    navigate(`/city/${cityId}`);
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">
          Select a City
        </h1>
        {locations.map((province) => (
          <div key={province.province_id} className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">
              {province.province}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {province.cities.map((city) => (
                <div
                  key={city.id}
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 ease-in-out cursor-pointer"
                  onClick={() => handleCitySelect(city.id)}
                >
                  <img
                    src={city.logo}
                    alt={`${city.name} Logo`}
                    className="w-full h-48 object-cover rounded-t-lg"
                  />
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-800">
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
