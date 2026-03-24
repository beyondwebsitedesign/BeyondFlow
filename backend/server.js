// ================= SERVER.JS =================
const express = require('express');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));

app.use(express.json());

// ---------------- DATABASE ----------------
let db = { clients: [], referrals: [] };
const dbPath = './data/db.json';

if (fs.existsSync(dbPath)) {
  db = JSON.parse(fs.readFileSync(dbPath));
}

function saveDB() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

// ---------------- USERS ----------------
let users = [
  { username: 'admin', password: bcrypt.hashSync('password123', 10) }
];

// ---------------- LOGIN ----------------
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ success: false, message: 'Invalid credentials' });

  // Just respond with success (no JWT)
  res.json({ success: true });
});

// ---------------- CLIENTS ----------------
app.get('/clients', (req, res) => res.json(db.clients));

app.post('/clients', (req, res) => {
  const client = {
    id: Date.now(),
    name: req.body.name,
    phone: req.body.phone || '',
    email: req.body.email || '',
    status: 'Lead',
    notes: '',
    projects: []
  };
  db.clients.push(client);
  saveDB();
  res.json({ success: true, client });
});

app.put('/clients/:id', (req, res) => {
  const client = db.clients.find(c => c.id === Number(req.params.id));
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  client.name = req.body.name || client.name;
  client.phone = req.body.phone ?? client.phone;
  client.email = req.body.email ?? client.email;
  saveDB();
  res.json({ success: true, client });
});

app.put('/clients/:id/notes', (req, res) => {
  const client = db.clients.find(c => c.id === Number(req.params.id));
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  client.notes = req.body.notes || '';
  saveDB();
  res.json({ success: true, notes: client.notes });
});

app.put('/clients/:id/status', (req, res) => {
  const client = db.clients.find(c => c.id === Number(req.params.id));
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  client.status = req.body.status || 'Lead';
  saveDB();
  res.json({ success: true, status: client.status });
});

app.delete('/clients/:id', (req, res) => {
  const client = db.clients.find(c => c.id === Number(req.params.id));
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  db.clients = db.clients.filter(c => c.id !== client.id);
  db.referrals = db.referrals.filter(r => r.referrer !== client.name);
  saveDB();
  res.json({ success: true });
});

// ---------------- PROJECTS ----------------
app.post('/clients/:id/projects', (req, res) => {
  const client = db.clients.find(c => c.id === Number(req.params.id));
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  const project = {
    id: Date.now(),
    name: req.body.name,
    price: req.body.price || 0,
    dateStarted: req.body.dateStarted || '',
    dateEnded: req.body.dateEnded || '',
    description: req.body.description || ''
  };

  client.projects = client.projects || [];
  client.projects.push(project);
  saveDB();
  res.json({ success: true, project });
});

app.put('/clients/:clientId/projects/:projectId', (req, res) => {
  const client = db.clients.find(c => c.id === Number(req.params.clientId));
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  const project = client.projects.find(p => p.id === Number(req.params.projectId));
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  project.name = req.body.name || project.name;
  project.price = req.body.price ?? project.price;
  project.dateStarted = req.body.dateStarted || project.dateStarted;
  project.dateEnded = req.body.dateEnded || project.dateEnded;
  project.description = req.body.description || project.description;

  saveDB();
  res.json({ success: true, project });
});

app.delete('/clients/:clientId/projects/:projectId', (req, res) => {
  const client = db.clients.find(c => c.id === Number(req.params.clientId));
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  client.projects = (client.projects || []).filter(p => p.id !== Number(req.params.projectId));
  saveDB();
  res.json({ success: true });
});

// ---------------- REFERRALS ----------------
app.get('/referrals', (req, res) => res.json(db.referrals));

app.post('/referrals', (req, res) => {
  const referral = {
    id: Date.now(),
    referrer: req.body.referrer,
    referred: req.body.referred,
    type: req.body.type,
    credit: req.body.credit
  };
  db.referrals.push(referral);
  saveDB();
  res.json({ success: true, referral });
});

app.put('/referrals/:id', (req, res) => {
  const referral = db.referrals.find(r => r.id === Number(req.params.id));
  if (!referral) return res.status(404).json({ success: false, error: 'Referral not found' });

  referral.referrer = req.body.referrer || referral.referrer;
  referral.referred = req.body.referred || referral.referred;
  referral.type = req.body.type || referral.type;
  referral.credit = req.body.credit ?? referral.credit;
  saveDB();
  res.json({ success: true, referral });
});

app.delete('/referrals/:id', (req, res) => {
  db.referrals = db.referrals.filter(r => r.id !== Number(req.params.id));
  saveDB();
  res.json({ success: true });
});

// ---------------- REFERRAL STATS ----------------
app.get('/referrals/stats', (req, res) => {
  const totalCredits = db.referrals.reduce((sum, r) => sum + (r.credit || 0), 0);
  const perReferrer = db.referrals.reduce((acc, r) => {
    acc[r.referrer] = (acc[r.referrer] || 0) + r.credit;
    return acc;
  }, {});
  res.json({ totalReferrals: db.referrals.length, totalCredits, perReferrer });
});

// ---------------- TODOS ----------------
app.get('/todos', (req, res) => {
  res.json(db.todos);
});

app.post('/todos', (req, res) => {
  const todo = {
    id: Date.now(),
    text: req.body.text,
    completed: false
  };

  db.todos.push(todo);
  saveDB();
  res.json({ success: true, todo });
});

app.put('/todos/:id', (req, res) => {
  const todo = db.todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ success: false });

  todo.completed = req.body.completed;
  saveDB();
  res.json({ success: true, todo });
});

app.put('/todos/reorder', (req, res) => {
  console.log('REORDER ENDPOINT HIT');
  const { order } = req.body;

  console.log('Incoming order:', order);

  if (!Array.isArray(order)) {
    return res.status(400).json({ success: false });
  }

  const newTodos = [];

  order.forEach(id => {
    const todo = db.todos.find(t => t.id.toString() === id.toString());
    if (todo) newTodos.push(todo);
  });

  // ⚠️ VERY IMPORTANT: keep any missing todos
  db.todos.forEach(t => {
    if (!newTodos.find(nt => nt.id === t.id)) {
      newTodos.push(t);
    }
  });

  db.todos = newTodos;

  saveDB();

  console.log('Saved order:', db.todos.map(t => t.id));

  res.json({ success: true });
});

// events database
db.events = db.events || [];

// ---------------- EVENTS ----------------
app.get('/events', (req, res) => res.json(db.events));

app.post('/events', (req, res) => {
  const event = {
    id: Date.now(),
    title: req.body.title,
    date: req.body.date
  };
  db.events.push(event);
  saveDB();
  res.json(event); // return the saved event including id
});

app.put('/events/:id', (req, res) => {
  const event = db.events.find(e => e.id === Number(req.params.id));
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });

  event.title = req.body.title || event.title;
  event.date = req.body.date || event.date;

  saveDB();
  res.json({ success: true, event });
});

app.delete('/events/:id', (req, res) => {
  db.events = db.events.filter(e => e.id !== Number(req.params.id));
  saveDB();
  res.json({ success: true });
});

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});
// ---------------- START SERVER ----------------
app.listen(PORT, () => console.log(`BeyondFlow backend running on port ${PORT}`));