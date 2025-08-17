import fs from 'fs';
import path from 'path';
import { jest } from '@jest/globals';
import { main } from './search-amap-spots-in-scenic-area.js';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path');

// Mock the searchSpotsInScenicArea function
jest.mock('./searchAmapSpots.js', () => ({
  searchSpotsInScenicArea: jest.fn(),
}));

describe('search-amap-spots-in-scenic-area.js', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('main function', () => {
    it('should exit with error if required arguments are missing', () => {
      // Mock process.argv to simulate missing arguments
      process.argv = ['node', 'search-amap-spots-in-scenic-area.js'];
      
      // Mock process.exit
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      // Call main function
      main();
      
      // Verify error handling
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should parse command line arguments correctly', () => {
      // Mock process.argv with valid arguments
      process.argv = [
        'node',
        'search-amap-spots-in-scenic-area.js',
        'province',
        'city',
        'scenicAreaName',
        '--radius',
        '1000',
        '--query',
        '景点',
        '--type',
        '风景名胜',
        '--delay',
        '2000',
      ];
      
      // Call main function
      main();
      
      // Verify parsed options
      expect(process.argv[2]).toBe('province');
      expect(process.argv[3]).toBe('city');
      expect(process.argv[4]).toBe('scenicAreaName');
    });

    it('should handle scenic area file not found error', () => {
      // Mock process.argv with valid arguments
      process.argv = ['node', 'search-amap-spots-in-scenic-area.js', 'province', 'city', 'scenicAreaName'];
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Mock process.exit
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      // Call main function
      main();
      
      // Verify error handling
      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should call searchSpotsInScenicArea with correct parameters', async () => {
      // Mock process.argv with valid arguments
      process.argv = ['node', 'search-amap-spots-in-scenic-area.js', 'province', 'city', 'scenicAreaName'];
      
      // Mock fs.existsSync to return true
      fs.existsSync.mockReturnValue(true);
      
      // Mock fs.readFileSync to return valid scenic area data
      fs.readFileSync.mockReturnValue(JSON.stringify({
        scenicAreas: [{ name: 'scenicAreaName' }],
      }));
      
      // Mock searchSpotsInScenicArea to return a result
      require('./searchAmapSpots').searchSpotsInScenicArea.mockResolvedValue({
        count: 10,
      });
      
      // Call main function
      await main();
      
      // Verify searchSpotsInScenicArea was called
      expect(require('./searchAmapSpots').searchSpotsInScenicArea).toHaveBeenCalled();
    });
  });
});