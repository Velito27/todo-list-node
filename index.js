const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DATA_FILE = path.join(__dirname, 'tasks.json');
const PORT = process.env.PORT || 3000;

function readTasks() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

function requestHandler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

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

  if (req.method === 'GET' && pathname === '/tasks') {
    const tasks = readTasks();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(tasks));
    return;
  }

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
        if (!newTask.title) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Task title is required');
          return;
        }
        tasks.push(newTask);
        writeTasks(tasks);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(newTask));
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid JSON');
      }
    });
    return;
  }

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
          if (update.title !== undefined) {
            tasks[taskIndex].title = String(update.title).trim();
          }
          if (update.completed !== undefined) {
            tasks[taskIndex].completed = Boolean(update.completed);
          }
          writeTasks(tasks);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(tasks[taskIndex]));
        } catch {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Invalid JSON');
        }
      });
      return;
    }
    if (req.method === 'DELETE') {
      tasks.splice(taskIndex, 1);
      writeTasks(tasks);
      res.writeHead(204);
      res.end();
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
}

const server = http.createServer(requestHandler);
server.listen(PORT, () => {
  console.log(`Todo List server is running at http://localhost:${PORT}/`);
});