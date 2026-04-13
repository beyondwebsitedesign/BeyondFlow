// ================= SERVER.JS =================
import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const app = express();
const PORT = process.env.PORT || 3000;
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ---------------- MONGODB ----------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected!"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(cors({ origin: '*' }));
app.use(express.json());



// ---------------- LOGIN ----------------
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
     if (!user.isActive) {
  return res.status(403).json({
    success: false,
    message: 'Your account is pending activation. Once payment is received, your access will be turned on.'
  });
}

    const passwordMatches = bcrypt.compareSync(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        businessName: user.businessName,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});
app.post('/signup', async (req, res) => {
  try {
    const { businessName, username, email, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const existingUser = await User.findOne({
      $or: [
        { username },
        ...(email ? [{ email }] : [])
      ]
    });

    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    const user = await User.create({
      businessName: businessName || '',
      username,
      email: email || '',
      password: hashedPassword
    });

res.json({
  success: true,
  message: 'Account created successfully. Your account is pending activation after payment.'
});

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, error: 'Server error during signup' });
  }
});

// ---------------- SCHEMAS ----------------
const { Schema, model } = mongoose;

const UserSchema = new Schema({
  businessName: { type: String, default: '' },
  username: { type: String, required: true, unique: true },
  email: { type: String, default: '', unique: true, sparse: true },
  password: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  paidAt: { type: String, default: '' },
  defaultInvoiceTerms: {
    type: String,
    default: `Terms & Conditions

1. Payment is due by the date listed on this invoice. Late payments may be subject to additional fees as permitted by law.

2. This invoice reflects the agreed services, products, or work requested. Additional work outside the original scope may result in added charges.

3. Deposits, if required, are non-refundable unless otherwise agreed in writing.

4. If services are canceled after work has begun, the client is responsible for payment for all work completed up to the cancellation date.

5. The client agrees to provide all necessary information, approvals, and access required to complete the work in a timely manner.

6. Ownership of deliverables transfers only after full payment has been received.

7. Payment of this invoice constitutes acceptance of these terms and conditions.`
  },
  createdAt: { type: Date, default: Date.now }
});
const ItemSchema = new Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String,
  rate: Number,
  createdAt: { type: Date, default: Date.now }
});

const Item = model('Item', ItemSchema);
const User = model('User', UserSchema);

const ClientSchema = new Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String,
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  website: { type: String, default: '' },
  status: { type: String, default: 'Lead' },
  notes: { type: String, default: '' },
  projects: { type: Array, default: [] }
});
const Client = model('Client', ClientSchema);

const ReferralSchema = new Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  referrer: String,
  referred: String,
  type: String,
  credit: Number
});
const Referral = model('Referral', ReferralSchema);

const TodoSchema = new Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  text: String,
  completed: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const Todo = model('Todo', TodoSchema);

const EventSchema = new Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  title: String,
  date: String,
  client: { type: String, default: '' }
});
const Event = model('Event', EventSchema);

const InvoiceSchema = new Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  invoiceNumber: String,
  issueDate: String,
  dueDate: String,
  clientId: { type: String, default: '' },
  clientName: { type: String, default: '' },
  clientEmail: { type: String, default: '' },
  clientPhone: { type: String, default: '' },
  clientWebsite: { type: String, default: '' },
  status: { type: String, default: 'Draft' },
  notes: { type: String, default: '' },
  items: {
    type: [
      {
        description: String,
        quantity: Number,
        rate: Number,
        amount: Number
      }
    ],
    default: []
  },
  subtotal: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const Invoice = model('Invoice', InvoiceSchema);

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// ---------------- CLIENTS ----------------
app.get('/clients', authenticate, async (req, res) => {
  const clients = await Client.find({ ownerId: req.user.id });
  res.json(clients);
});

app.post('/clients', authenticate, async (req, res) => {
  const client = await Client.create({
    ...req.body,
    ownerId: req.user.id
  });
  res.json({ success: true, client });
});

app.put('/clients/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ success: false, error: 'Invalid ID' });

  const client = await Client.findOneAndUpdate(
    { _id: id, ownerId: req.user.id },
    req.body,
    { new: true }
  );

  if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
  res.json({ success: true, client });
});

app.put('/clients/:id/notes', authenticate, async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const client = await Client.findOneAndUpdate(
    { _id: id, ownerId: req.user.id },
    { notes: req.body.notes || '' },
    { new: true }
  );

  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }

  res.json({ success: true, notes: client.notes });
});

app.put('/clients/:id/status', authenticate, async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const client = await Client.findOneAndUpdate(
    { _id: id, ownerId: req.user.id },
    { status: req.body.status || 'Lead' },
    { new: true }
  );

  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }

  res.json({ success: true, status: client.status });
});

app.delete('/clients/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const client = await Client.findOneAndDelete({
    _id: id,
    ownerId: req.user.id
  });

  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }

  await Referral.deleteMany({
    ownerId: req.user.id,
    referrer: client.name
  });

  res.json({ success: true });
});

// ---------------- PROJECTS ----------------
app.get('/clients/:id/projects', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const client = await Client.findOne({
    _id: id,
    ownerId: req.user.id
  });

  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }

  res.json({ success: true, projects: client.projects });
});

app.post('/clients/:id/projects', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const client = await Client.findOne({
    _id: id,
    ownerId: req.user.id
  });

  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }

  const project = { id: Date.now(), ...req.body };
  client.projects.push(project);
  await client.save();

  res.json({ success: true, project });
});

app.put('/clients/:clientId/projects/:projectId', authenticate, async (req, res) => {
  const { clientId, projectId } = req.params;

  if (!isValidId(clientId)) {
    return res.status(400).json({ success: false, error: 'Invalid Client ID' });
  }

  const client = await Client.findOne({
    _id: clientId,
    ownerId: req.user.id
  });

  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }

  const project = client.projects.find(p => p.id === Number(projectId));
  if (!project) {
    return res.status(404).json({ success: false, error: 'Project not found' });
  }

  Object.assign(project, req.body);
  await client.save();

  res.json({ success: true, project });
});

app.delete('/clients/:clientId/projects/:projectId', authenticate, async (req, res) => {
  const { clientId, projectId } = req.params;

  if (!isValidId(clientId)) {
    return res.status(400).json({ success: false, error: 'Invalid Client ID' });
  }

  const client = await Client.findOne({
    _id: clientId,
    ownerId: req.user.id
  });

  if (!client) {
    return res.status(404).json({ success: false, error: 'Client not found' });
  }

  client.projects = client.projects.filter(p => p.id !== Number(projectId));
  await client.save();

  res.json({ success: true });
});

// ---------------- REFERRALS ----------------
app.get('/referrals', authenticate, async (req, res) => {
  const referrals = await Referral.find({ ownerId: req.user.id });
  res.json(referrals);
});

app.post('/referrals', authenticate, async (req, res) => {
  const referral = await Referral.create({
    ...req.body,
    ownerId: req.user.id
  });

  res.json({ success: true, referral });
});

app.put('/referrals/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const referral = await Referral.findOneAndUpdate(
    { _id: id, ownerId: req.user.id },
    req.body,
    { new: true }
  );

  if (!referral) {
    return res.status(404).json({ success: false, error: 'Referral not found' });
  }

  res.json({ success: true, referral });
});

app.delete('/referrals/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const referral = await Referral.findOneAndDelete({
    _id: id,
    ownerId: req.user.id
  });

  if (!referral) {
    return res.status(404).json({ success: false, error: 'Referral not found' });
  }

  res.json({ success: true });
});

app.get('/referrals/stats', authenticate, async (req, res) => {
  const referrals = await Referral.find({ ownerId: req.user.id });

  const totalCredits = referrals.reduce((sum, r) => sum + (r.credit || 0), 0);

  const perReferrer = referrals.reduce((acc, r) => {
    acc[r.referrer] = (acc[r.referrer] || 0) + r.credit;
    return acc;
  }, {});

  res.json({
    totalReferrals: referrals.length,
    totalCredits,
    perReferrer
  });
});
// ---------------- TODOS ----------------
app.get('/todos', authenticate, async (req, res) => {
  const todos = await Todo.find({ ownerId: req.user.id }).sort({ order: 1, createdAt: 1 });
  res.json(todos);
});

app.post('/todos', authenticate, async (req, res) => {
  const todo = await Todo.create({
    ...req.body,
    ownerId: req.user.id
  });

  res.json({ success: true, todo });
});

app.put('/todos/reorder', authenticate, async (req, res) => {
  const { order } = req.body;

  if (!Array.isArray(order)) {
    return res.status(400).json({ success: false, error: 'Order must be an array' });
  }

  for (let i = 0; i < order.length; i++) {
    if (!isValidId(order[i])) continue;

    await Todo.findOneAndUpdate(
      { _id: order[i], ownerId: req.user.id },
      { order: i }
    );
  }

  res.json({ success: true });
});

app.put('/todos/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const todo = await Todo.findOneAndUpdate(
    { _id: id, ownerId: req.user.id },
    req.body,
    { new: true }
  );

  if (!todo) {
    return res.status(404).json({ success: false, error: 'Todo not found' });
  }

  res.json({ success: true, todo });
});

app.delete('/todos/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const todo = await Todo.findOneAndDelete({
    _id: id,
    ownerId: req.user.id
  });

  if (!todo) {
    return res.status(404).json({ success: false, error: 'Todo not found' });
  }

  res.json({ success: true });
});
// ---------------- EVENTS ----------------
app.get('/events', authenticate, async (req, res) => {
  const events = await Event.find({ ownerId: req.user.id });
  res.json(events);
});

app.post('/events', authenticate, async (req, res) => {
  const event = await Event.create({
    ...req.body,
    ownerId: req.user.id
  });

  res.json({ success: true, event });
});

app.put('/events/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const event = await Event.findOneAndUpdate(
    { _id: id, ownerId: req.user.id },
    req.body,
    { new: true }
  );

  if (!event) {
    return res.status(404).json({ success: false, error: 'Event not found' });
  }

  res.json({ success: true, event });
});

app.delete('/events/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const event = await Event.findOneAndDelete({
    _id: id,
    ownerId: req.user.id
  });

  if (!event) {
    return res.status(404).json({ success: false, error: 'Event not found' });
  }

  res.json({ success: true });
});

// ---------------- INVOICES ----------------
app.get('/invoices', authenticate, async (req, res) => {
  const invoices = await Invoice.find({ ownerId: req.user.id }).sort({ createdAt: -1 });
  res.json(invoices);
});
app.get('/items', authenticate, async (req, res) => {
  const items = await Item.find({ ownerId: req.user.id }).sort({ name: 1 });
  res.json(items);
});
app.get('/stats/revenue', authenticate, async (req, res) => {
  const invoices = await Invoice.find({ ownerId: req.user.id });

  const paidInvoices = invoices.filter(inv => inv.status === 'Paid' && inv.paidAt);
  const outstandingInvoices = invoices.filter(inv => inv.status !== 'Paid');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(currentYear, i, 1).toLocaleString('en-US', { month: 'short' }),
    revenue: 0
  }));

  const yearlyMap = {};

  let thisMonthRevenue = 0;
  let lastMonthRevenue = 0;
  let thisYearRevenue = 0;
  let lastYearRevenue = 0;
  let outstandingRevenue = 0;

  for (const inv of outstandingInvoices) {
    outstandingRevenue += Number(inv.total || 0);
  }

  for (const inv of paidInvoices) {
    const total = Number(inv.total || 0);
    const paidDate = new Date(inv.paidAt);

    if (Number.isNaN(paidDate.getTime())) continue;

    const year = paidDate.getFullYear();
    const month = paidDate.getMonth();

    yearlyMap[year] = (yearlyMap[year] || 0) + total;

    if (year === currentYear) {
      thisYearRevenue += total;
      monthlyBreakdown[month].revenue += total;

      if (month === currentMonth) {
        thisMonthRevenue += total;
      }

      if (month === currentMonth - 1) {
        lastMonthRevenue += total;
      }
    }

    if (year === currentYear - 1) {
      lastYearRevenue += total;
    }

    if (currentMonth === 0 && year === currentYear - 1 && month === 11) {
      lastMonthRevenue += total;
    }
  }

  const yearlyBreakdown = Object.entries(yearlyMap)
    .map(([year, revenue]) => ({
      year: Number(year),
      revenue
    }))
    .sort((a, b) => a.year - b.year);

  const paidInvoiceCount = paidInvoices.length;

  res.json({
    success: true,
    thisMonthRevenue,
    lastMonthRevenue,
    thisYearRevenue,
    lastYearRevenue,
    outstandingRevenue,
    paidInvoiceCount,
    monthlyBreakdown,
    yearlyBreakdown
  });
});
app.post('/invoices', authenticate, async (req, res) => {
  const invoiceData = {
    ...req.body,
    ownerId: req.user.id
  };

  if (invoiceData.status === 'Paid' && !invoiceData.paidAt) {
    invoiceData.paidAt = new Date().toISOString();
  }

  const invoice = await Invoice.create(invoiceData);

  for (const item of req.body.items || []) {
    if (!item.description) continue;

    await Item.updateOne(
      { ownerId: req.user.id, name: item.description },
      { $set: { rate: item.rate } },
      { upsert: true }
    );
  }

  res.json({ success: true, invoice });
});

app.put('/invoices/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const existingInvoice = await Invoice.findOne({
    _id: id,
    ownerId: req.user.id
  });

  if (!existingInvoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  const updateData = { ...req.body };

  if (updateData.status === 'Paid' && !existingInvoice.paidAt) {
    updateData.paidAt = new Date().toISOString();
  }

  if (updateData.status !== 'Paid') {
    updateData.paidAt = '';
  }

  const invoice = await Invoice.findOneAndUpdate(
    { _id: id, ownerId: req.user.id },
    updateData,
    { new: true }
  );

  for (const item of req.body.items || []) {
    if (!item.description) continue;

    await Item.updateOne(
      { ownerId: req.user.id, name: item.description },
      { $set: { rate: item.rate } },
      { upsert: true }
    );
  }

  res.json({ success: true, invoice });
});

app.delete('/invoices/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const invoice = await Invoice.findOneAndDelete({
    _id: id,
    ownerId: req.user.id
  });

  if (!invoice) {
    return res.status(404).json({ success: false, error: 'Invoice not found' });
  }

  res.json({ success: true });
});
app.delete('/items/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(400).json({ success: false, error: 'Invalid ID' });
  }

  const item = await Item.findOneAndDelete({
    _id: id,
    ownerId: req.user.id
  });

  if (!item) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  res.json({ success: true });
});
app.get('/me/default-invoice-terms', authenticate, async (req, res) => {
  const user = await User.findById(req.user.id).select('defaultInvoiceTerms');
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({
    success: true,
    defaultInvoiceTerms: user.defaultInvoiceTerms
  });
});

app.put('/me/default-invoice-terms', authenticate, async (req, res) => {
  const { defaultInvoiceTerms } = req.body;

if (!defaultInvoiceTerms || !defaultInvoiceTerms.trim()) {
  return res.status(400).json({
    success: false,
    error: 'Default terms cannot be empty'
  });
}

const user = await User.findByIdAndUpdate(
  req.user.id,
  { defaultInvoiceTerms },
  { new: true }
).select('defaultInvoiceTerms');

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({
    success: true,
    defaultInvoiceTerms: user.defaultInvoiceTerms
  });
});

app.post('/me/default-invoice-terms/reset', authenticate, async (req, res) => {
  const defaultTerms = `Terms & Conditions

1. Payment is due by the date listed on this invoice. Late payments may be subject to additional fees as permitted by law.

2. This invoice reflects the agreed services, products, or work requested. Additional work outside the original scope may result in added charges.

3. Deposits, if required, are non-refundable unless otherwise agreed in writing.

4. If services are canceled after work has begun, the client is responsible for payment for all work completed up to the cancellation date.

5. The client agrees to provide all necessary information, approvals, and access required to complete the work in a timely manner.

6. Ownership of deliverables transfers only after full payment has been received.

7. Payment of this invoice constitutes acceptance of these terms and conditions.`;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    { defaultInvoiceTerms: defaultTerms },
    { new: true }
  ).select('defaultInvoiceTerms');

  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  res.json({
    success: true,
    defaultInvoiceTerms: user.defaultInvoiceTerms
  });
});
// ---------------- FRONTEND ----------------
import path from 'path';
import { fileURLToPath } from 'url';

// ES module replacements for __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'frontend')));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});
// ---------------- START SERVER ----------------
app.listen(PORT, () => console.log(`BeyondFlow backend running on port ${PORT}`));