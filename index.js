const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Path to persist tasks on disk. Using a JSON file keeps the implementation
// very simple and avoids the need for any external databases or packages.
const DATA_FILE = path.join(__dirname, 'tasks.json');
const PORT = process.env.PORT || 3000;

/**
 * Reads the existing tasks from disk. If the file does not exist or
 * contains invalid JSON, an empty array is returned. Synchronous file
 * operations are used here for simplicity since the data set is expected
 * to be very small.
 *
 * @returns {Array<{id:number,title:string,completed:boolean}>}
 */
function readTasks() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    // If the file cannot be read or parsed, default to an empty array.
    return [];
  }
}

/**
 * Writes the provided tasks array to disk as formatted JSON. This
 * overwrites any existing file contents.
 *
 * @param {Array<{id:number,title:string,completed:boolean}>} tasks
 */
function writeTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

/**
 * Handles incoming HTTP requests. Routes are implemented manually to
 * avoid adding third‑party dependencies like Express. This handler
 * supports static file serving, listing tasks, creating tasks,
 * updating tasks and deleting tasks.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function requestHandler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Serve the frontend. The app only has a single HTML file which
  // provides the user interface for the todo list. Additional static
  // files could be served from here if needed.
  if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
    const indexPath = path.join(__dirname, 'index.html');
    fs.readFile(indexPath, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error loading index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }

  // API endpoint to list all tasks.
  if (req.method === 'GET' && pathname === '/tasks') {
    const tasks = readTasks();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tasks));
    return;
  }

  // API endpoint to create a new task. Expects a JSON body with a
  // `title` property. The new task is given a unique ID based on
  // the current timestamp.
  if (req.method === 'POST' && pathname === '/tasks') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const tasks = readTasks();
        const newTask = {
          id: Date.now(),
          title: String(data.title || '').trim(),
          completed: false,
        };
        // Reject empty titles to avoid creating blank tasks.
        if (!newTask.title) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Task title is required');
          return;
        }
        tasks.push(newTask);
        writeTasks(tasks);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newTask));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid JSON');
      }
    });
    return;
  }

  // API endpoints for updating or deleting a specific task. The task
  // identifier is extracted from the URL path using a simple regular
  // expression. Note that only numeric IDs are supported.
  const idMatch = /^\/tasks\/(\d+)$/.exec(pathname);
  if (idMatch) {
    const taskId = Number(idMatch[1]);
    const tasks = readTasks();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Task not found');
      return;
    }
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          const update = JSON.parse(body || '{}');
          // Only allow updating allowed fields (title or completed)
          if (update.title !== undefined) {
            tasks[taskIndex].title = String(update.title).trim();
          }
          if (update.completed !== undefined) {
            tasks[taskIndex].completed = Boolean(update.completed);
          }
          writeTasks(tasks);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(tasks[taskIndex]));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid JSON');
        }
      });
      return;
    }
    if (req.method === 'DELETE') {
      tasks.splice(taskIndex, 1);
      writeTasks(tasks);
      // 204 No Content indicates successful deletion with no response body
      res.writeHead(204);
      res.end();
      return;
    }
  }

  // If none of the above routes matched, return a 404 response.
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

// Create and start the HTTP server. When the server starts it logs
// the listening port to stdout. To stop the server press Ctrl+C.
const server = http.createServer(requestHandler);
server.listen(PORT, () => {
  console.log(`Todo List server is running at http://localhost:${PORT}/`);
});