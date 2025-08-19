import fs from 'fs';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import path from 'path';
import process from 'process';

class TaskQueue extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();
    this.running = new Map();
    this.maxConcurrent = 3;
    this.loadTasksFromFile();
    this.processQueue();
  }

  // Load tasks from file on startup
  loadTasksFromFile() {
    try {
      if (fs.existsSync('cache/tasks.json')) {
        const tasksData = JSON.parse(fs.readFileSync('cache/tasks.json', 'utf8'));
        tasksData.forEach(task => {
          // Reset running tasks to pending on startup
          if (task.status === 'running') {
            task.status = 'pending';
          }
          this.tasks.set(task.id, task);
        });
        console.log(`Loaded ${this.tasks.size} tasks from file`);
      }
    } catch (error) {
      console.error('Failed to load tasks from file:', error.message);
    }
  }

  // Save tasks to file
  saveTasksToFile() {
    try {
      if (!fs.existsSync('cache')) {
        fs.mkdirSync('cache', { recursive: true });
      }
      
      const tasksArray = Array.from(this.tasks.values());
      fs.writeFileSync('cache/tasks.json', JSON.stringify(tasksArray, null, 2));
    } catch (error) {
      console.error('Failed to save tasks to file:', error.message);
    }
  }

  // Add a new task
  addTask(type, data, options = {}) {
    const task = {
      id: uuidv4(),
      type,
      status: 'pending', // pending, running, completed, failed
      progress: 0,
      data,
      result: null,
      error: null,
      logs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...options
    };

    this.tasks.set(task.id, task);
    this.saveTasksToFile();
    this.emit('taskAdded', task);
    
    console.log(`Added task: ${type} (${task.id})`);
    return task.id;
  }

  // Update task status
  updateTask(taskId, updates) {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    Object.assign(task, updates, {
      updatedAt: new Date().toISOString()
    });

    this.tasks.set(taskId, task);
    this.saveTasksToFile();
    this.emit('taskUpdated', task);
    
    return true;
  }

  // Add log to task
  addTaskLog(taskId, message, level = 'info') {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message
    };

    task.logs.push(logEntry);
    task.updatedAt = new Date().toISOString();
    
    this.tasks.set(taskId, task);
    this.saveTasksToFile();
    this.emit('taskLog', { taskId, log: logEntry });
    
    return true;
  }

  // Get task by ID
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  // Get all tasks
  getAllTasks() {
    return Array.from(this.tasks.values()).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  // Get tasks by status
  getTasksByStatus(status) {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  // Process the queue
  async processQueue() {
    setInterval(async () => {
      const pendingTasks = this.getTasksByStatus('pending');
      const runningCount = this.running.size;

      if (pendingTasks.length > 0 && runningCount < this.maxConcurrent) {
        const task = pendingTasks[0];
        await this.executeTask(task);
      }
    }, 1000);
  }

  // Execute a task
  async executeTask(task) {
    if (this.running.has(task.id)) return;

    this.running.set(task.id, true);
    this.updateTask(task.id, { status: 'running', progress: 0 });
    this.addTaskLog(task.id, `Starting task: ${task.type}`);

    try {
      let result;
      
      switch (task.type) {
        case 'ORGANIZE_PROVINCE_DATA':
          result = await this.executeOrganizeProvinceData(task);
          break;
        case 'SEARCH_CITY_SPOTS':
          result = await this.executeSearchCitySpots(task);
          break;
        case 'SEARCH_NEARBY_SPOTS':
          result = await this.executeSearchNearbySpots(task);
          break;
        case 'GENERATE_SUMMARY':
          result = await this.executeGenerateSummary(task);
          break;
        case 'PROCESS_NARRATION':
          // result = await this.executeProcessNarration(task);
          break;
        case 'CREATE_CITY_STRUCTURE':
          result = await this.executeCreateCityStructure(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      this.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        result
      });
      this.addTaskLog(task.id, 'Task completed successfully', 'success');

    } catch (error) {
      this.updateTask(task.id, {
        status: 'failed',
        error: error.message
      });
      this.addTaskLog(task.id, `Task failed: ${error.message}`, 'error');
      console.error(`Task ${task.id} failed:`, error);
    } finally {
      this.running.delete(task.id);
    }
  }

  // Execute search nearby spots script
  async executeSearchNearbySpots(task) {
    const { scenicArea, cityPath, options = {}, provider = 'baidu' } = task.data;
    
    this.addTaskLog(task.id, `Searching spots for ${scenicArea.name} using ${provider} Map API`);
    this.updateTask(task.id, { progress: 10 });

    // Ensure output directory exists
    const spotsDir = path.join(cityPath, 'data', 'spots');
    if (!fs.existsSync(spotsDir)) {
      fs.mkdirSync(spotsDir, { recursive: true });
    }

    // Check if we have center coordinates
    if (!scenicArea.center && !scenicArea.coordinates) {
      this.addTaskLog(task.id, `No center coordinates found for ${scenicArea.name}`, 'error');
      throw new Error(`No center coordinates found for ${scenicArea.name}`);
    }

    // Use center or coordinates field
    const center = scenicArea.center || scenicArea.coordinates;
    const coordinates = `${center.lng},${center.lat}`;
    
    // Determine radius based on scenic area level or provided radius
    let radius = options.radius;
    if (!radius) {
      if (scenicArea.radius) {
        radius = scenicArea.radius;
      } else {
        // Default radius based on scenic area level
        radius = scenicArea.level === '5A' ? 1500 : 
                 scenicArea.level === '4A' ? 1000 : 500;
      }
    }
    
    const spotFileName = `${scenicArea.name.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '')}.json`;
    const fullOutputPath = path.join(spotsDir, spotFileName);

    // Determine which script to use based on provider
    const scriptName = provider === 'amap' ? 'searchAmapSpots.js' : 'searchNearbySpots.js';
    const query = options.query || '景点';
    const typeOption = options.type ? `--type "${options.type}"` : '';
    
    const command = `node scripts/${scriptName} "${coordinates}" ${radius} -o "${fullOutputPath}" -q "${query}" ${typeOption}`;
    
    this.addTaskLog(task.id, `Executing: ${command}`);
    this.updateTask(task.id, { progress: 30 });

    return new Promise((resolve, reject) => {
      exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          this.addTaskLog(task.id, `Script error: ${error.message}`, 'error');
          reject(error);
          return;
        }

        if (stderr) {
          this.addTaskLog(task.id, `Script stderr: ${stderr}`, 'warn');
        }

        this.addTaskLog(task.id, `Script output: ${stdout}`);
        this.updateTask(task.id, { progress: 80 });

        // Verify output file was created
        if (fs.existsSync(fullOutputPath)) {
          const stats = fs.statSync(fullOutputPath);
          const result = {
            outputFile: fullOutputPath,
            fileSize: stats.size,
            spotsFile: `spots/${spotFileName}`
          };
          
          this.addTaskLog(task.id, `Created spots file: ${fullOutputPath} (${stats.size} bytes)`);
          resolve(result);
        } else {
          reject(new Error('Output file was not created'));
        }
      });
    });
  }

  // Execute generate summary script
  async executeGenerateSummary(task) {
    const { cityPath } = task.data;
    
    this.addTaskLog(task.id, `Generating summary for ${cityPath}`);
    this.updateTask(task.id, { progress: 10 });

    const command = `node scripts/generate_scenic_area_summary.js "${cityPath}"`;
    
    this.addTaskLog(task.id, `Executing: ${command}`);
    this.updateTask(task.id, { progress: 30 });

    return new Promise((resolve, reject) => {
      exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          this.addTaskLog(task.id, `Script error: ${error.message}`, 'error');
          reject(error);
          return;
        }

        if (stderr) {
          this.addTaskLog(task.id, `Script stderr: ${stderr}`, 'warn');
        }

        this.addTaskLog(task.id, `Script output: ${stdout}`);
        this.updateTask(task.id, { progress: 80 });

        const summaryFile = path.join(cityPath, 'data', 'scenic-area.json');
        if (fs.existsSync(summaryFile)) {
          const stats = fs.statSync(summaryFile);
          const result = {
            summaryFile,
            fileSize: stats.size
          };
          
          this.addTaskLog(task.id, `Updated summary file: ${summaryFile} (${stats.size} bytes)`);
          resolve(result);
        } else {
          reject(new Error('Summary file was not created'));
        }
      });
    });
  }

  // Execute process narration script
  async executeProcessNarration(task) {
    const { spotsFile, outputDir, cityName, areaName } = task.data;
    
    this.addTaskLog(task.id, `Processing narration for ${areaName}`);
    this.updateTask(task.id, { progress: 10 });

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const command = `node scripts/process-spot-narration.js "${spotsFile}" "${outputDir}" --city-name "${cityName}" --area-name "${areaName}"`;
    
    this.addTaskLog(task.id, `Executing: ${command}`);
    this.updateTask(task.id, { progress: 30 });

    return new Promise((resolve, reject) => {
      const child = exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          this.addTaskLog(task.id, `Script error: ${error.message}`, 'error');
          reject(error);
          return;
        }

        if (stderr) {
          this.addTaskLog(task.id, `Script stderr: ${stderr}`, 'warn');
        }

        this.addTaskLog(task.id, `Script completed`);
        
        const result = {
          outputDir,
          stdout,
          stderr
        };
        
        resolve(result);
      });

      // Monitor progress
      let progressInterval = setInterval(() => {
        const currentProgress = this.getTask(task.id)?.progress || 30;
        if (currentProgress < 90) {
          this.updateTask(task.id, { progress: currentProgress + 5 });
        } else {
          clearInterval(progressInterval);
        }
      }, 2000);

      child.on('close', () => {
        clearInterval(progressInterval);
      });
    });
  }

  // Execute create city structure
  async executeCreateCityStructure(task) {
    const { provinceName, cityName, scenicAreas } = task.data;
    
    this.addTaskLog(task.id, `Creating city structure for ${cityName}`);
    this.updateTask(task.id, { progress: 10 });

    const provinceId = provinceName.toLowerCase();
    const cityId = cityName.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '');
    const cityPath = path.join('assets', provinceId, cityId);
    const dataPath = path.join(cityPath, 'data');
    const scenicAreaFile = path.join(dataPath, 'scenic-area.json');

    // Create directory structure
    if (!fs.existsSync(dataPath)) {
      fs.mkdirSync(dataPath, { recursive: true });
      this.addTaskLog(task.id, `Created directory: ${dataPath}`);
    }

    this.updateTask(task.id, { progress: 30 });

    // Create other directories
    const directories = ['images', 'thumb', 'audio'];
    directories.forEach(dir => {
      const dirPath = path.join(cityPath, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.addTaskLog(task.id, `Created directory: ${dirPath}`);
      }
    });

    this.updateTask(task.id, { progress: 50 });

    // Transform scenic areas to our format
    const formattedAreas = scenicAreas.map(area => ({
      name: area.name,
      description: area.description,
      center: {
        lat: area.coordinates.lat,
        lng: area.coordinates.lng
      },
      radius: area.level === '5A' ? 1500 : area.level === '4A' ? 1000 : 500,
      level: 18,
      spotsFile: `spots/${area.name.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, '')}.json`,
      display: 'show',
      grade: area.level,
      address: area.address
    }));

    this.updateTask(task.id, { progress: 70 });

    // Save scenic-area.json
    fs.writeFileSync(scenicAreaFile, JSON.stringify(formattedAreas, null, 2));
    this.addTaskLog(task.id, `Created scenic-area.json with ${formattedAreas.length} areas`);

    this.updateTask(task.id, { progress: 90 });

    const result = {
      cityPath,
      cityId,
      scenicAreaFile,
      areasCount: formattedAreas.length,
      directories: directories.map(dir => path.join(cityPath, dir))
    };

    this.addTaskLog(task.id, `City structure created successfully`);
    return result;
  }

  // Clear completed tasks
  clearCompletedTasks() {
    const completedTasks = this.getTasksByStatus('completed');
    completedTasks.forEach(task => {
      this.tasks.delete(task.id);
    });
    this.saveTasksToFile();
    return completedTasks.length;
  }

  // Clear completed and failed tasks
  clearCompletedAndFailedTasks() {
    const completedTasks = this.getTasksByStatus('completed');
    const failedTasks = this.getTasksByStatus('failed');
    const allTasksToDelete = [...completedTasks, ...failedTasks];
    
    allTasksToDelete.forEach(task => {
      this.tasks.delete(task.id);
    });
    this.saveTasksToFile();
    return allTasksToDelete.length;
  }

  // Retry failed task
  retryTask(taskId) {
    const task = this.getTask(taskId);
    if (!task || task.status !== 'failed') return false;

    this.updateTask(taskId, {
      status: 'pending',
      progress: 0,
      error: null,
      logs: [...task.logs, {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Task retried'
      }]
    });

    return true;
  }

  // Execute organize province data using organize-scenic-areas-by-city-csv.js
  async executeOrganizeProvinceData(task) {
    const { provinceName } = task.data;
    
    this.addTaskLog(task.id, `Organizing scenic areas data for ${provinceName} province using CSV script`);
    this.updateTask(task.id, { progress: 10 });

    // Use the organize-scenic-areas-by-city-csv.js script
    const command = `node scripts/organize-scenic-areas-by-city-csv.js province ${provinceName}`;
    
    this.addTaskLog(task.id, `Executing: ${command}`);
    this.updateTask(task.id, { progress: 20 });

    return new Promise((resolve, reject) => {
      exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          this.addTaskLog(task.id, `Script error: ${error.message}`, 'error');
          reject(error);
          return;
        }

        if (stderr) {
          this.addTaskLog(task.id, `Script stderr: ${stderr}`, 'warn');
        }

        this.addTaskLog(task.id, `Script output: ${stdout}`);
        this.updateTask(task.id, { progress: 80 });

        // After organizing province data, automatically create city spot search tasks
        this.scheduleFollowUpTasks(provinceName, task.id);
        
        const result = {
          provinceName,
          command,
          stdout,
          message: 'Province data organized successfully, follow-up tasks scheduled'
        };
        
        resolve(result);
      });
    });
  }

  // Execute search city spots using search-amap-spots-in-city.js
  async executeSearchCitySpots(task) {
    const { cityPath } = task.data;
    
    this.addTaskLog(task.id, `Searching spots for all scenic areas in city: ${cityPath}`);
    this.updateTask(task.id, { progress: 10 });

    // Find the scenic-area.json file
    const scenicAreaFile = path.join(cityPath, 'data', 'scenic-area.json');
    if (!fs.existsSync(scenicAreaFile)) {
      throw new Error(`Scenic area file not found: ${scenicAreaFile}`);
    }

    // Use the search-amap-spots-in-city.js script
    const command = `node scripts/search-amap-spots-in-city.js "${scenicAreaFile}"`;
    
    this.addTaskLog(task.id, `Executing: ${command}`);
    this.updateTask(task.id, { progress: 30 });

    return new Promise((resolve, reject) => {
      exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
        if (error) {
          this.addTaskLog(task.id, `Script error: ${error.message}`, 'error');
          reject(error);
          return;
        }

        if (stderr) {
          this.addTaskLog(task.id, `Script stderr: ${stderr}`, 'warn');
        }

        this.addTaskLog(task.id, `Script output: ${stdout}`);
        this.updateTask(task.id, { progress: 90 });

        // Verify spots directory was created
        const spotsDir = path.join(cityPath, 'data', 'spots');
        if (fs.existsSync(spotsDir)) {
          const spotsFiles = fs.readdirSync(spotsDir).filter(f => f.endsWith('.json'));
          const result = {
            cityPath,
            spotsDir,
            spotsCount: spotsFiles.length,
            command,
            stdout
          };
          
          this.addTaskLog(task.id, `Created ${spotsFiles.length} spots files in ${spotsDir}`);
          resolve(result);
        } else {
          reject(new Error('Spots directory was not created'));
        }
      });
    });
  }

  // Schedule follow-up tasks after organizing province data
  async scheduleFollowUpTasks(provinceName, parentTaskId) {
    try {
      this.addTaskLog(parentTaskId, `Scheduling follow-up tasks for ${provinceName}`);
      
      // Find all cities in the province that were created
      // Use the province name directly since we're using Chinese names now
      const provincePath = path.join('assets', provinceName);
      if (!fs.existsSync(provincePath)) {
        this.addTaskLog(parentTaskId, `Province directory not found: ${provincePath}`, 'warn');
        this.addTaskLog(parentTaskId, `No follow-up tasks will be scheduled for ${provinceName}`);
        return;
      }

      let dirents;
      try {
        dirents = fs.readdirSync(provincePath, { withFileTypes: true });
      } catch (error) {
        this.addTaskLog(parentTaskId, `Error reading province directory: ${error.message}`, 'error');
        return;
      }

      if (!dirents || !Array.isArray(dirents)) {
        this.addTaskLog(parentTaskId, `Invalid directory contents for ${provincePath}`, 'error');
        return;
      }

      const cities = dirents
        .filter(dirent => dirent && dirent.isDirectory && dirent.isDirectory())
        .map(dirent => ({
          name: dirent.name,
          path: path.join(provincePath, dirent.name)
        }));

      if (!cities || cities.length === 0) {
        this.addTaskLog(parentTaskId, `No cities found in ${provincePath}`);
        return;
      }

      this.addTaskLog(parentTaskId, `Found ${cities.length} cities to process`);

      // Create spot search tasks for each city
      cities.forEach((city, index) => {
        if (!city || !city.name || !city.path) {
          this.addTaskLog(parentTaskId, `Invalid city data at index ${index}`, 'warn');
          return;
        }

        setTimeout(() => {
          try {
            const searchTaskId = this.addTask('SEARCH_CITY_SPOTS', {
              cityPath: city.path
            }, {
              description: `Search spots for all scenic areas in ${city.name}`,
              dependsOn: parentTaskId
            });
            
            this.addTaskLog(parentTaskId, `Created SEARCH_CITY_SPOTS task for ${city.name}: ${searchTaskId}`);

            // Schedule summary generation after spot search
            setTimeout(() => {
              try {
                const summaryTaskId = this.addTask('GENERATE_SUMMARY', {
                  cityPath: city.path
                }, {
                  description: `Generate summary for ${city.name}`,
                  dependsOn: searchTaskId
                });
                
                this.addTaskLog(parentTaskId, `Created GENERATE_SUMMARY task for ${city.name}: ${summaryTaskId}`);
              } catch (error) {
                this.addTaskLog(parentTaskId, `Error creating GENERATE_SUMMARY task for ${city.name}: ${error.message}`, 'error');
              }
            }, 1000);
          } catch (error) {
            this.addTaskLog(parentTaskId, `Error creating SEARCH_CITY_SPOTS task for ${city.name}: ${error.message}`, 'error');
          }
        }, index * 2000); // Stagger city processing by 2 seconds
      });

    } catch (error) {
      this.addTaskLog(parentTaskId, `Error scheduling follow-up tasks: ${error.message}`, 'error');
    }
  }
}

export default TaskQueue;
