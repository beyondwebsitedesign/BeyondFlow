// ================= SERVER.JS =================
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------- MONGODB ----------------
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected!"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(cors({ origin: '*' }));
app.use(express.json());

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
  res.json({ success: true });
});

// ---------------- SCHEMAS ----------------
const { Schema, model } = mongoose;

const ClientSchema = new Schema({
  name: String,
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  status: { type: String, default: 'Lead' },
  notes: { type: String, default: '' },
  projects: { type: Array, default: [] }
});
const Client = model('Client', ClientSchema);

const ReferralSchema = new Schema({
  referrer: String,
  referred: String,
  type: String,
  credit: Number
});
const Referral = model('Referral', ReferralSchema);

const TodoSchema = new Schema({
  text: String,
  completed: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Todo = model('Todo', TodoSchema);

const EventSchema = new Schema({
  title: String,
  date: String
});
const Event = model('Event', EventSchema);

// ---------------- CLIENTS ----------------
app.get('/clients', async (req, res) => res.json(await Client.find()));

app.post('/clients', async (req, res) => {
  const client = await Client.create(req.body);
  res.json({ success: true, client });
});

app.put('/clients/:id', async (req, res) => {
  const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
  res.json({ success: true, client });
});

app.put('/clients/:id/notes', async (req, res) => {
  const client = await Client.findByIdAndUpdate(req.params.id, { notes: req.body.notes || '' }, { new: true });
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
  res.json({ success: true, notes: client.notes });
});

app.put('/clients/:id/status', async (req, res) => {
  const client = await Client.findByIdAndUpdate(req.params.id, { status: req.body.status || 'Lead' }, { new: true });
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
  res.json({ success: true, status: client.status });
});

app.delete('/clients/:id', async (req, res) => {
  const client = await Client.findByIdAndDelete(req.params.id);
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
  await Referral.deleteMany({ referrer: client.name });
  res.json({ success: true });
});

// ---------------- PROJECTS ----------------
app.post('/clients/:id/projects', async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  const project = { id: Date.now(), ...req.body };
  client.projects.push(project);
  await client.save();
  res.json({ success: true, project });
});

app.put('/clients/:clientId/projects/:projectId', async (req, res) => {
  const client = await Client.findById(req.params.clientId);
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  const project = client.projects.find(p => p.id === Number(req.params.projectId));
  if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

  Object.assign(project, req.body);
  await client.save();
  res.json({ success: true, project });
});

app.delete('/clients/:clientId/projects/:projectId', async (req, res) => {
  const client = await Client.findById(req.params.clientId);
  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });

  client.projects = client.projects.filter(p => p.id !== Number(req.params.projectId));
  await client.save();
  res.json({ success: true });
});

// ---------------- REFERRALS ----------------
app.get('/referrals', async (req, res) => res.json(await Referral.find()));

app.post('/referrals', async (req, res) => {
  const referral = await Referral.create(req.body);
  res.json({ success: true, referral });
});

app.put('/referrals/:id', async (req, res) => {
  const referral = await Referral.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!referral) return res.status(404).json({ success: false, error: 'Referral not found' });
  res.json({ success: true, referral });
});

app.delete('/referrals/:id', async (req, res) => {
  await Referral.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.get('/referrals/stats', async (req, res) => {
  const referrals = await Referral.find();
  const totalCredits = referrals.reduce((sum, r) => sum + (r.credit || 0), 0);
  const perReferrer = referrals.reduce((acc, r) => {
    acc[r.referrer] = (acc[r.referrer] || 0) + r.credit;
    return acc;
  }, {});
  res.json({ totalReferrals: referrals.length, totalCredits, perReferrer });
});

// ---------------- TODOS ----------------
app.get('/todos', async (req, res) => res.json(await Todo.find().sort({ order: 1, createdAt: 1 })));

app.post('/todos', async (req, res) => {
  const todo = await Todo.create(req.body);
  res.json({ success: true, todo });
});

app.put('/todos/:id', async (req, res) => {
  const todo = await Todo.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!todo) return res.status(404).json({ success: false });
  res.json({ success: true, todo });
});

app.put('/todos/reorder', async (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ success: false });

  for (let i = 0; i < order.length; i++) {
    await Todo.findByIdAndUpdate(order[i], { order: i });
  }

  res.json({ success: true });
});

app.delete('/todos/:id', async (req, res) => {
  await Todo.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ---------------- EVENTS ----------------
app.get('/events', async (req, res) => res.json(await Event.find()));

app.post('/events', async (req, res) => {
  const event = await Event.create(req.body);
  res.json({ success: true, event });
});

app.put('/events/:id', async (req, res) => {
  const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
  res.json({ success: true, event });
});

app.delete('/events/:id', async (req, res) => {
  await Event.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// ---------------- FRONTEND ----------------
const path = require('path');
app.use(express.static(path.join(__dirname, 'frontend')));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => console.log(`BeyondFlow backend running on port ${PORT}`));