// ================= DASHBOARD.JS =================
const apiBase = 'https://beyondflow-production.up.railway.app';

// ---------------- STATE ----------------
let currentClientId = localStorage.getItem('currentClientId') || null;
let currentInvoiceId = null;
let invoiceClients = [];
let savedItems = [];
let calendar;
let userDefaultInvoiceTerms = '';
let signaturePad = null;
let signatureCtx = null;
let isDrawingSignature = false;
let hasSignature = false;
let revenueStats = null;
let revenueView = 'monthly';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}
async function fetchSavedItems() {
  try {
    const res = await fetch(`${apiBase}/items`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error('Failed to load saved items');

    savedItems = await res.json();

    const list = document.getElementById('saved-items-list');
    if (!list) return;

    list.innerHTML = savedItems.map(item => `
      <li>
        <span style="cursor:pointer;" onclick="useSavedItem('${item._id}')">
          ${item.name} - $${Number(item.rate || 0).toFixed(2)}
        </span>
        <button onclick="deleteSavedItem('${item._id}')">Delete</button>
      </li>
    `).join('');
  } catch (err) {
    console.error('Fetch saved items error:', err);
  }
}
async function fetchDefaultInvoiceTerms() {
  try {
    const res = await fetch(`${apiBase}/me/default-invoice-terms`, {
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to load default invoice terms');
    }

    userDefaultInvoiceTerms = data.defaultInvoiceTerms || '';
    return userDefaultInvoiceTerms;
  } catch (err) {
    console.error('Fetch default invoice terms error:', err);
    return '';
  }
}

async function saveDefaultTerms() {
  const notes = document.getElementById('invoice-notes').value.trim();
  if (!notes) return alert('Enter terms in the notes box first.');

  try {
    const res = await fetch(`${apiBase}/me/default-invoice-terms`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ defaultInvoiceTerms: notes })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save default terms');
    }

    userDefaultInvoiceTerms = data.defaultInvoiceTerms || '';
    alert('Default invoice terms saved.');
  } catch (err) {
    console.error('Save default terms error:', err);
    alert('Error saving default terms: ' + err.message);
  }
}

async function resetDefaultTerms() {
  try {
    const res = await fetch(`${apiBase}/me/default-invoice-terms/reset`, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reset default terms');
    }

    userDefaultInvoiceTerms = data.defaultInvoiceTerms || '';
    document.getElementById('invoice-notes').value = userDefaultInvoiceTerms;

    alert('Default invoice terms reset.');
  } catch (err) {
    console.error('Reset default terms error:', err);
    alert('Error resetting default terms: ' + err.message);
  }
}

const DEFAULT_INVOICE_TERMS = `Terms & Conditions

1. Payment is due by the date listed on this invoice. Late payments may be subject to additional fees as permitted by law.

2. This invoice reflects the agreed services, products, or work requested. Additional work outside the original scope may result in added charges.

3. Deposits, if required, are non-refundable unless otherwise agreed in writing.

4. If services are canceled after work has begun, the client is responsible for payment for all work completed up to the cancellation date.

5. The client agrees to provide all necessary information, approvals, and access required to complete the work in a timely manner.

6. Ownership of deliverables transfers only after full payment has been received.

7. Payment of this invoice constitutes acceptance of these terms and conditions.`;

// ---------------- CLIENTS ----------------
async function fetchClients() {
  try {
    const res = await fetch(`${apiBase}/clients`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load clients');

    const clients = await res.json();
    const sortOption = document.getElementById('client-sort')?.value || 'name-asc';

    clients.sort((a, b) => {
      switch (sortOption) {
        case 'name-asc': return a.name.localeCompare(b.name);
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'email': return (a.email || '').localeCompare(b.email || '');
        case 'phone': return (a.phone || '').localeCompare(b.phone || '');
        default: return 0;
      }
    });

    const list = document.getElementById('clients-list');
    if (!list) return;

    list.innerHTML = '';
    clients.forEach(c => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span onclick="openClient('${c._id}')" style="cursor:pointer;">
          ${c.name} (${c.phone || 'No phone'}, ${c.email || 'No email'})
        </span>
        <button onclick="editClient('${c._id}')">Edit</button>
        <button onclick="deleteClient('${c._id}')">Delete</button>
      `;
      list.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    alert('Failed to load clients');
  }
}

async function addClient() {
  const name = document.getElementById('client-name').value.trim();
  const phone = document.getElementById('client-phone').value.trim();
  const email = document.getElementById('client-email').value.trim();
  const website = document.getElementById('client-website').value.trim();

  if (!name) return alert('Enter a name');

  try {
    const res = await fetch(`${apiBase}/clients`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, phone, email, website })
    });

    if (!res.ok) throw new Error('Failed to add client');

    document.getElementById('client-name').value = '';
    document.getElementById('client-phone').value = '';
    document.getElementById('client-email').value = '';
    document.getElementById('client-website').value = '';

    await fetchClients();
    await updateStats();
    await fetchClientsForInvoice();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

async function editClient(id) {
  try {
    const res = await fetch(`${apiBase}/clients`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load clients');

    const clients = await res.json();
    const client = clients.find(c => c._id === id);
    if (!client) return alert('Client not found');

    const newName = prompt('Edit name:', client.name);
    const newPhone = prompt('Edit phone:', client.phone || '');
    const newEmail = prompt('Edit email:', client.email || '');
    const newWebsite = prompt('Edit website:', client.website || '');

    if (!newName) return alert('Name is required');

    const editRes = await fetch(`${apiBase}/clients/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name: newName,
        phone: newPhone,
        email: newEmail,
        website: newWebsite
      })
    });

    if (!editRes.ok) throw new Error('Failed to edit client');

    await fetchClients();
    await updateStats();
    await fetchClientsForInvoice();

    if (currentClientId === id) {
      await openClient(id);
    }
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

async function deleteClient(id) {
  if (!confirm('Are you sure?')) return;

  try {
    const res = await fetch(`${apiBase}/clients/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error('Failed to delete client');

    if (currentClientId === id) {
      closeProfile();
    }

    await fetchClients();
    await updateStats();
    await fetchClientsForInvoice();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

async function saveNotes() {
  if (!currentClientId) return alert('No client selected');

  const notes = document.getElementById('profile-notes').value;

  try {
    const res = await fetch(`${apiBase}/clients/${currentClientId}/notes`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes })
    });

    if (!res.ok) throw new Error('Failed to save notes');
    alert('Notes saved');
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// ---------------- EXPORT CLIENTS ----------------
async function exportClientsCSV() {
  try {
    const res = await fetch(`${apiBase}/clients`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load clients');

    const clients = await res.json();
    if (!clients.length) return alert('No clients to export.');

    const headers = ['ID', 'Name', 'Phone', 'Email', 'Website', 'Status', 'Notes'];
    const rows = clients.map(c => [
      c._id,
      c.name,
      c.phone,
      c.email,
      c.website || '',
      c.status,
      c.notes
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clients.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export clients error:', err);
    alert('Error exporting clients: ' + err.message);
  }
}

// ---------------- IMPORT CLIENTS ----------------
async function importClientsCSV() {
  const fileInput = document.getElementById('import-file');
  const file = fileInput.files[0];
  if (!file) return alert('Select a CSV file to import.');

  const text = await file.text();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = lines.slice(1);

  for (const row of rows) {
    const cols = row.split(',').map(c => c.trim());
    const clientData = {
      name: cols[headers.indexOf('name')] || '',
      phone: cols[headers.indexOf('phone')] || '',
      email: cols[headers.indexOf('email')] || '',
      status: cols[headers.indexOf('status')] || 'Lead',
      notes: cols[headers.indexOf('notes')] || '',
      website: cols[headers.indexOf('website')] || ''
    };

    if (!clientData.name) continue;

    try {
      await fetch(`${apiBase}/clients`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(clientData)
      });
    } catch (err) {
      console.error('Import client error:', err);
    }
  }

  alert('Clients imported successfully!');
  await fetchClients();
  await updateStats();
  await fetchClientsForInvoice();
}

window.exportClientsCSV = exportClientsCSV;
window.importClientsCSV = importClientsCSV;

// ---------------- REFERRALS ----------------
async function fetchReferrals() {
  try {
    const res = await fetch(`${apiBase}/referrals`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load referrals');

    const referrals = await res.json();
    const sortOption = document.getElementById('referral-sort')?.value || 'referrer-asc';

    referrals.sort((a, b) => {
      switch (sortOption) {
        case 'referrer-asc': return a.referrer.localeCompare(b.referrer);
        case 'referrer-desc': return b.referrer.localeCompare(a.referrer);
        case 'credit': return (a.credit || 0) - (b.credit || 0);
        default: return 0;
      }
    });

    const list = document.getElementById('referrals-list');
    if (!list) return;

    list.innerHTML = referrals.map(r => `
      <li>
        ${r.referrer} → ${r.referred} ($${r.credit})
        <button onclick="editReferral('${r._id}')">Edit</button>
        <button onclick="deleteReferral('${r._id}')">Delete</button>
      </li>
    `).join('');
  } catch (err) {
    console.error(err);
    alert('Failed to load referrals');
  }
}

async function addReferral() {
  const referrer = document.getElementById('referrer-name').value.trim();
  const referred = document.getElementById('referred-name').value.trim();
  const type = document.getElementById('referral-type').value;

  if (!referrer || !referred) return alert('Enter both names');

  const credit = type === 'partner' ? 30 : 25;

  try {
    const res = await fetch(`${apiBase}/referrals`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ referrer, referred, credit, type })
    });

    if (!res.ok) throw new Error('Failed to add referral');

    document.getElementById('referrer-name').value = '';
    document.getElementById('referred-name').value = '';

    await fetchReferrals();
    await updateStats();
  } catch (err) {
    console.error('Add referral error:', err);
    alert('Error adding referral: ' + err.message);
  }
}

async function editReferral(id) {
  try {
    const res = await fetch(`${apiBase}/referrals`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load referrals');

    const referrals = await res.json();
    const referral = referrals.find(r => r._id === id);
    if (!referral) return alert('Referral not found');

    const newReferrer = prompt('Edit referrer name:', referral.referrer);
    const newReferred = prompt('Edit referred name:', referral.referred);
    const newType = prompt('Edit type (standard/partner):', referral.type);

    if (!newReferrer || !newReferred || !newType) return alert('Invalid input');

    const newCredit = newType === 'partner' ? 30 : 25;

    const editRes = await fetch(`${apiBase}/referrals/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        referrer: newReferrer,
        referred: newReferred,
        type: newType,
        credit: newCredit
      })
    });

    if (!editRes.ok) throw new Error('Failed to edit referral');

    await fetchReferrals();
    await updateStats();
  } catch (err) {
    console.error('Edit referral error:', err);
    alert('Error editing referral: ' + err.message);
  }
}

async function deleteReferral(id) {
  if (!confirm('Are you sure you want to delete this referral?')) return;

  try {
    const res = await fetch(`${apiBase}/referrals/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error('Failed to delete referral');

    await fetchReferrals();
    await updateStats();
  } catch (err) {
    console.error('Delete referral error:', err);
    alert('Error deleting referral: ' + err.message);
  }
}

window.editReferral = editReferral;
window.deleteReferral = deleteReferral;

// ---------------- PROJECTS ----------------
async function addProject() {
  if (!currentClientId) return alert('No client selected');

  const name = document.getElementById('project-name').value.trim();
  const description = document.getElementById('project-description').value.trim();
  const price = Number(document.getElementById('project-price').value) || 0;
  const dateStarted = document.getElementById('project-started').value;
  const dateEnded = document.getElementById('project-ended').value;

  if (!name) return alert('Enter a project name');

  try {
    const res = await fetch(`${apiBase}/clients/${currentClientId}/projects`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name,
        description,
        price,
        dateStarted,
        dateEnded
      })
    });

    if (!res.ok) throw new Error('Failed to add project');

    document.getElementById('project-name').value = '';
    document.getElementById('project-description').value = '';
    document.getElementById('project-price').value = '';
    document.getElementById('project-started').value = '';
    document.getElementById('project-ended').value = '';

    await openClient(currentClientId);
  } catch (err) {
    console.error('Add project error:', err);
    alert('Error adding project: ' + err.message);
  }
}

async function deleteProject(clientId, projectId) {
  if (!confirm('Delete this project?')) return;

  try {
    const res = await fetch(`${apiBase}/clients/${clientId}/projects/${projectId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error('Failed to delete project');

    await openClient(clientId);
  } catch (err) {
    console.error('Delete project error:', err);
    alert('Error deleting project: ' + err.message);
  }
}

async function editProject(clientId, projectId) {
  try {
    const res = await fetch(`${apiBase}/clients`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load clients');

    const clients = await res.json();
    const client = clients.find(c => c._id === clientId);
    const project = client?.projects?.find(p => p.id === Number(projectId));

    if (!project) return alert('Project not found');

    const name = prompt('Project name:', project.name);
    const description = prompt('Description:', project.description);
    const price = prompt('Price:', project.price);
    const dateStarted = prompt('Start date:', project.dateStarted);
    const dateEnded = prompt('End date:', project.dateEnded);

    if (!name) return alert('Name required');

    const updateRes = await fetch(`${apiBase}/clients/${clientId}/projects/${projectId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name,
        description,
        price: Number(price) || 0,
        dateStarted,
        dateEnded
      })
    });

    if (!updateRes.ok) throw new Error('Failed to update project');

    await openClient(clientId);
  } catch (err) {
    console.error('Edit project error:', err);
    alert('Error editing project: ' + err.message);
  }
}

// ---------------- CLIENT PROFILE ----------------
async function openClient(id) {
  currentClientId = id;
  localStorage.setItem('currentClientId', id);

  document.getElementById('client-profile').style.display = 'block';

  const res = await fetch(`${apiBase}/clients`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to load clients');

  const clients = await res.json();
  const client = clients.find(c => c._id === id);
  if (!client) return;

  document.getElementById('profile-name').textContent = client.name;
  document.getElementById('profile-phone').textContent = client.phone || '';
  document.getElementById('profile-email').textContent = client.email || '';

  const websiteEl = document.getElementById('profile-website');
  const website = client.website || '';
  if (websiteEl) {
    if (website) {
      const formattedWebsite = website.startsWith('http') ? website : `https://${website}`;
      websiteEl.textContent = website;
      websiteEl.href = formattedWebsite;
    } else {
      websiteEl.textContent = '';
      websiteEl.removeAttribute('href');
    }
  }

  document.getElementById('profile-status').value = client.status || 'Lead';
  document.getElementById('profile-notes').value = client.notes || '';

  const projectList = document.getElementById('profile-projects');
  projectList.innerHTML = (client.projects || []).map(p => `
    <li>
      <strong>${p.name}</strong> - ${p.description}
      ($${p.price})
      <button onclick="editProject('${id}', '${p.id}')">Edit</button>
      <button onclick="deleteProject('${id}', '${p.id}')">Delete</button>
    </li>
  `).join('');

  const clientEvents = calendar.getEvents().filter(ev => ev.extendedProps.client === client.name);
  clientEvents.forEach(ev => {
    const li = document.createElement('li');
    li.textContent = `Scheduled: ${ev.title} - ${ev.start.toLocaleString()}`;
    li.dataset.eventClient = client.name;
    li.dataset.eventTitle = ev.title;
    projectList.appendChild(li);
  });

  const refRes = await fetch(`${apiBase}/referrals`, {
    headers: getAuthHeaders()
  });
  const referrals = await refRes.json();
  const clientRefs = referrals.filter(r => r.referrer === client.name);

  document.getElementById('profile-referrals').innerHTML = clientRefs.map(r => {
    const referredClient = clients.find(
      c => c.name.trim().toLowerCase() === r.referred.trim().toLowerCase()
    );

    if (referredClient) {
      return `
        <li>
          <span onclick="openClient('${referredClient._id}')" style="cursor:pointer; color:blue; text-decoration:underline;">
            ${r.referred}
          </span>
          ($${r.credit})
        </li>
      `;
    }

    return `<li>${r.referred} ($${r.credit})</li>`;
  }).join('');

  const invoiceRes = await fetch(`${apiBase}/invoices`, {
    headers: getAuthHeaders()
  });
  const invoices = await invoiceRes.json();
  const clientInvoices = invoices.filter(inv => inv.clientId === client._id);

  document.getElementById('profile-invoices').innerHTML = clientInvoices.map(inv => `
    <li>
      <span onclick="loadInvoice('${inv._id}')" style="cursor:pointer; color:gold; text-decoration:underline;">
        ${inv.invoiceNumber || 'No Number'} - $${(inv.total || 0).toFixed(2)}
      </span>
      <span class="invoice-status invoice-status-${(inv.status || 'Draft').toLowerCase()}">
        ${inv.status || 'Draft'}
      </span>
    </li>
  `).join('');
}

function closeProfile() {
  const profile = document.getElementById('client-profile');
  profile.style.display = 'none';
  currentClientId = null;
  localStorage.removeItem('currentClientId');

  document.getElementById('profile-name').textContent = '';
  document.getElementById('profile-phone').textContent = '';
  document.getElementById('profile-email').textContent = '';

  const websiteEl = document.getElementById('profile-website');
  if (websiteEl) {
    websiteEl.textContent = '';
    websiteEl.removeAttribute('href');
  }

  document.getElementById('profile-notes').value = '';
  document.getElementById('profile-status').value = 'Lead';
  document.getElementById('profile-projects').innerHTML = '';
  document.getElementById('profile-referrals').innerHTML = '';
  document.getElementById('profile-invoices').innerHTML = '';
}

async function saveStatus() {
  if (!currentClientId) return;

  const status = document.getElementById('profile-status').value;

  try {
    const res = await fetch(`${apiBase}/clients/${currentClientId}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });

    if (!res.ok) throw new Error('Failed to save status');

    await fetchClients();
    await updateStats();
    alert('Status saved!');
  } catch (err) {
    console.error('Save status error:', err);
    alert('Error saving status: ' + err.message);
  }
}

window.saveStatus = saveStatus;

// ---------------- STATS ----------------
async function updateStats() {
  const clientsRes = await fetch(`${apiBase}/clients`, {
    headers: getAuthHeaders()
  });
  const referralsRes = await fetch(`${apiBase}/referrals`, {
    headers: getAuthHeaders()
  });

  const clients = await clientsRes.json();
  const referrals = await referralsRes.json();

  document.getElementById('total-clients').textContent = clients.length;
  document.getElementById('total-referrals').textContent = referrals.length;
  document.getElementById('total-credits').textContent =
    `$${referrals.reduce((sum, r) => sum + (r.credit || 0), 0)}`;
}

// ---------------- EVENT HANDLERS ----------------
function handleClientActions(e) {
  const id = Number(e.target.dataset.id);
  if (e.target.classList.contains('client-name')) openClient(id);
  if (e.target.dataset.action === 'edit') console.log('edit client', id);
  if (e.target.dataset.action === 'delete') console.log('delete client', id);
}

function handleReferralActions(e) {
  const id = Number(e.target.dataset.id);
  if (e.target.dataset.action === 'edit') console.log('edit referral', id);
  if (e.target.dataset.action === 'delete') console.log('delete referral', id);
}

function handleProjectActions(e) {
  if (e.target.dataset.action === 'delete-project') {
    console.log('delete project', e.target.dataset.client, e.target.dataset.id);
  }
}

async function loadDailyVerse() {
  try {
    const res = await fetch('https://labs.bible.org/api/?passage=random&type=json');
    const data = await res.json();

    const verse = `${data[0].bookname} ${data[0].chapter}:${data[0].verse} - ${data[0].text}`;
    document.getElementById('daily-verse').textContent = verse;
  } catch (err) {
    console.error(err);
    document.getElementById('daily-verse').textContent = 'Unable to load verse.';
  }
}

loadDailyVerse();

// ---------------- TODOS ----------------
async function fetchTodos() {
  const res = await fetch(`${apiBase}/todos`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to load todos');

  const todos = await res.json();
  todos.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  window.todos = todos;

  const list = document.getElementById('todo-list');
  list.innerHTML = todos.map(t => `
    <li data-id="${t._id}" draggable="true" style="display:flex; align-items:center; gap:10px;">
      <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTodo('${t._id}', this.checked)">
      <span contenteditable="true" onblur="editTodoInline('${t._id}', this)" style="${t.completed ? 'text-decoration: line-through;' : ''}">
        ${t.text}
      </span>
      <button onclick="deleteTodo('${t._id}')">❌</button>
    </li>
  `).join('');

  enableTodoDragAndDrop();
}

async function addTodo() {
  const input = document.getElementById('todo-input');
  const text = input.value.trim();
  if (!text) return;

  await fetch(`${apiBase}/todos`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ text })
  });

  input.value = '';
  await fetchTodos();
}

async function toggleTodo(id, completed) {
  await fetch(`${apiBase}/todos/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ completed })
  });
}

async function deleteTodo(id) {
  try {
    const res = await fetch(`${apiBase}/todos/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!res.ok) throw new Error('Failed to delete todo');

    const li = document.querySelector(`#todo-list li[data-id="${id}"]`);
    if (li) li.remove();
  } catch (err) {
    console.error('Delete todo error:', err);
    alert('Error deleting todo: ' + err.message);
  }
}

async function editTodoInline(id, spanElement) {
  const newText = spanElement.textContent.trim();
  if (!newText) return;

  try {
    const res = await fetch(`${apiBase}/todos/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text: newText })
    });

    const data = await res.json();

    if (!data.success) {
      console.error('Failed to update todo');
      return;
    }

    spanElement.textContent = data.todo.text;

    if (window.todos && Array.isArray(window.todos)) {
      const index = window.todos.findIndex(t => t._id === id);
      if (index > -1) {
        window.todos[index].text = data.todo.text;
      }
    }
  } catch (err) {
    console.error('Error updating todo:', err);
  }
}

function enableTodoDragAndDrop() {
  const list = document.getElementById('todo-list');
  let dragged = null;

  list.querySelectorAll('li').forEach(item => {
    item.draggable = true;

    item.addEventListener('dragstart', () => {
      dragged = item;
      item.style.opacity = 0.5;
    });

    item.addEventListener('dragend', () => {
      item.style.opacity = 1;
      dragged = null;
    });
  });

  list.addEventListener('dragover', e => {
    e.preventDefault();
    const afterElement = getDragAfterElement(list, e.clientY);
    if (!afterElement) {
      list.appendChild(dragged);
    } else {
      list.insertBefore(dragged, afterElement);
    }
  });

  list.addEventListener('drop', async e => {
    e.preventDefault();
    if (!dragged) return;

    const newOrder = Array.from(list.children)
      .map(li => li.dataset.id)
      .filter(id => id);

    try {
      const res = await fetch(`${apiBase}/todos/reorder`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ order: newOrder })
      });

      const data = await res.json();
      console.log('SERVER RESPONSE:', data);
    } catch (err) {
      console.error('FETCH ERROR:', err);
    }
  });

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not([style*="opacity: 0.5"])')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
}

// ---------------- EVENTS ----------------
function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  if (calendar) calendar.destroy();

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    editable: true,
    selectable: true,
    events: [],
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    eventClick: async function(info) {
      const eventObj = info.event;
      const client = eventObj.extendedProps.client || '';

      alert(`Event: ${eventObj.title}\nClient: ${client}\nDate: ${eventObj.start.toLocaleString()}`);

      const action = prompt(`Edit or Delete this event?\nType "edit" to edit, "delete" to delete.`);
      if (!action) return;

      if (action.toLowerCase() === 'delete') {
        if (!confirm(`Are you sure you want to delete "${eventObj.title}"?`)) return;

        try {
          const res = await fetch(`${apiBase}/events/${eventObj.id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });

          if (!res.ok) throw new Error('Failed to delete event');

          eventObj.remove();

          if (currentClientId) {
            await openClient(currentClientId);
          }

          const profileEventsEl = document.getElementById('profile-events');
          if (profileEventsEl) {
            const items = Array.from(profileEventsEl.children);
            items.forEach(li => {
              if (li.dataset.eventId === eventObj.id) {
                li.remove();
              }
            });
          }
        } catch (err) {
          console.error('Delete event error:', err);
          alert('Failed to delete event');
        }
      } else if (action.toLowerCase() === 'edit') {
        const newTitle = prompt('Edit event title:', eventObj.title);
        const newDate = prompt(
          'Edit date/time (YYYY-MM-DDTHH:MM):',
          eventObj.start.toISOString().slice(0, 16)
        );

        if (!newTitle || !newDate) return alert('Invalid input');

        try {
          const res = await fetch(`${apiBase}/events/${eventObj.id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ title: newTitle, date: newDate })
          });

          if (!res.ok) throw new Error('Failed to update event');

          eventObj.setProp('title', newTitle);
          eventObj.setStart(newDate);
        } catch (err) {
          console.error('Edit event error:', err);
          alert('Failed to update event');
        }
      }
    }
  });

  calendar.render();
  fetchEvents();
}

async function addEvent() {
  const title = document.getElementById('event-title').value.trim();
  const date = document.getElementById('event-date').value;
  const time = document.getElementById('event-time').value;
  const client = document.getElementById('event-client').value.trim();

  if (!title || !date) return alert('Please enter a title and date');

  const dateTime = time ? `${date}T${time}` : date;

  try {
    const res = await fetch(`${apiBase}/events`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, date: dateTime, client })
    });

    if (!res.ok) throw new Error('Failed to save event');

    const data = await res.json();
    const savedEvent = data.event;

    calendar.addEvent({
      id: savedEvent._id,
      title: savedEvent.title,
      start: savedEvent.date,
      allDay: !time,
      extendedProps: { client: savedEvent.client || client || '' }
    });

    document.getElementById('event-title').value = '';
    document.getElementById('event-date').value = '';
    document.getElementById('event-time').value = '';
    document.getElementById('event-client').value = '';

    if (client) {
      await addEventToClientProfile(savedEvent._id, client, title, dateTime);
    }
  } catch (err) {
    console.error('Add event error:', err);
    alert('Error adding event: ' + err.message);
  }
}

async function addEventToClientProfile(eventId, clientName, title, dateTime) {
  const res = await fetch(`${apiBase}/clients`, {
    headers: getAuthHeaders()
  });
  const clients = await res.json();
  const client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
  if (!client) return;

  const profileEventsEl = document.getElementById('profile-events');
  if (!profileEventsEl) {
    const section = document.createElement('div');
    section.innerHTML = `<h3>Scheduled Events</h3><ul id="profile-events"></ul>`;
    document.getElementById('client-profile').appendChild(section);
  }

  const ul = document.getElementById('profile-events');
  const li = document.createElement('li');
  li.textContent = `${title} - ${new Date(dateTime).toLocaleString()}`;
  li.dataset.eventId = eventId;
  ul.appendChild(li);
}

async function fetchEvents() {
  try {
    const res = await fetch(`${apiBase}/events`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load events');

    const events = await res.json();
    calendar.removeAllEvents();

    events.forEach(ev => {
      calendar.addEvent({
        id: ev._id,
        title: ev.title,
        start: ev.date,
        allDay: !ev.date.includes('T'),
        extendedProps: { client: ev.client || '' }
      });
    });
  } catch (err) {
    console.error('Fetch events error:', err);
  }
}

async function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;

  try {
    const res = await fetch(`${apiBase}/events/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete event');
    await fetchEvents();
  } catch (err) {
    console.error('Delete event error:', err);
  }
}

window.initCalendar = initCalendar;
window.addEvent = addEvent;
window.fetchEvents = fetchEvents;
window.deleteEvent = deleteEvent;

// ---------------- INVOICES ----------------
async function fetchInvoices() {
  try {
    const res = await fetch(`${apiBase}/invoices`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load invoices');

    const invoices = await res.json();
    const history = document.getElementById('invoice-history');
    if (!history) return;

    history.innerHTML = invoices.map(inv => `
      <li>
        <span onclick="loadInvoice('${inv._id}')" style="cursor:pointer;">
          ${inv.invoiceNumber || 'No Number'} - ${inv.clientName || 'No Client'} - $${(inv.total || 0).toFixed(2)}
        </span>
        <span class="invoice-status invoice-status-${(inv.status || 'Draft').toLowerCase()}">
          ${inv.status || 'Draft'}
        </span>
      </li>
    `).join('');
  } catch (err) {
    console.error('Fetch invoices error:', err);
  }
}

async function fetchClientsForInvoice() {
  try {
    const res = await fetch(`${apiBase}/clients`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load clients');

    const clients = await res.json();
    invoiceClients = clients;

    const select = document.getElementById('invoice-client');
    if (!select) return;

    select.innerHTML = `<option value="">Select Client</option>` + clients.map(c => `
      <option value="${c._id}">${c.name}</option>
    `).join('');
  } catch (err) {
    console.error('Fetch invoice clients error:', err);
  }
}

function autofillInvoiceClient() {
  const clientId = document.getElementById('invoice-client').value;
  const client = invoiceClients.find(c => c._id === clientId);
  if (!client) return;

  document.getElementById('invoice-client-name').value = client.name || '';
  document.getElementById('invoice-client-email').value = client.email || '';
  document.getElementById('invoice-client-phone').value = client.phone || '';
  document.getElementById('invoice-client-website').value = client.website || '';
}

async function loadInvoice(id) {
  try {
    const res = await fetch(`${apiBase}/invoices`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load invoices');

    const invoices = await res.json();
    const invoice = invoices.find(inv => inv._id === id);
    if (!invoice) return alert('Invoice not found');

    currentInvoiceId = invoice._id;
    if (invoice.clientId) {
      currentClientId = invoice.clientId;
    }

    document.getElementById('invoice-number').value = invoice.invoiceNumber || '';
    document.getElementById('invoice-date').value = invoice.issueDate || '';
    document.getElementById('invoice-due-date').value = invoice.dueDate || '';
    document.getElementById('invoice-client').value = invoice.clientId || '';
    document.getElementById('invoice-client-name').value = invoice.clientName || '';
    document.getElementById('invoice-client-email').value = invoice.clientEmail || '';
    document.getElementById('invoice-client-phone').value = invoice.clientPhone || '';
    document.getElementById('invoice-client-website').value = invoice.clientWebsite || '';
    document.getElementById('invoice-status').value = invoice.status || 'Draft';
    document.getElementById('invoice-notes').value = invoice.notes || '';
        updatePaidDateVisibility();

const paidAtField = document.getElementById('invoice-paid-at');
if (paidAtField) {
  paidAtField.value = invoice.paidAt ? invoice.paidAt.split('T')[0] : '';
}

    const itemsContainer = document.getElementById('invoice-items');
    itemsContainer.innerHTML = '';

    (invoice.items || []).forEach(item => {
      addInvoiceItem(item.description, item.quantity, item.rate);
    });

    if (!invoice.items || !invoice.items.length) {
      addInvoiceItem();
    }

    recalculateInvoiceTotal();
  } catch (err) {
    console.error('Load invoice error:', err);
    alert('Error loading invoice');
  }
}

function addInvoiceItem(description = '', quantity = 1, rate = 0) {
  const container = document.getElementById('invoice-items');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'invoice-item-row';
 row.innerHTML = `
  <div class="autocomplete-wrapper">
    <input type="text" class="invoice-item-description" placeholder="Service / Item" value="${description}">
    <div class="autocomplete-list"></div>
  </div>
  <input type="number" class="invoice-item-qty" placeholder="Qty" value="${quantity}" min="1" step="1">
  <input type="number" class="invoice-item-rate" placeholder="Rate" value="${rate}" min="0" step="0.01">
  <span class="invoice-item-amount">$0.00</span>
  <button type="button" onclick="removeInvoiceItem(this)">Remove</button>
`;

  container.appendChild(row);
const descInput = row.querySelector('.invoice-item-description');
const list = row.querySelector('.autocomplete-list');
const rateInput = row.querySelector('.invoice-item-rate');

descInput.addEventListener('input', () => {
  const value = descInput.value.trim().toLowerCase();
  list.innerHTML = '';

  if (!value) return;

  const matches = savedItems.filter(item =>
    item.name.toLowerCase().includes(value)
  );

  matches.slice(0, 5).forEach(item => {
    const option = document.createElement('div');
    option.textContent = `${item.name} - $${Number(item.rate || 0).toFixed(2)}`;

    option.onclick = () => {
      descInput.value = item.name;
      rateInput.value = item.rate || 0;
      list.innerHTML = '';
      recalculateInvoiceTotal();
    };

    list.appendChild(option);
  });
});

  row.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', recalculateInvoiceTotal);
  });

  recalculateInvoiceTotal();
}

function removeInvoiceItem(button) {
  button.parentElement.remove();
  recalculateInvoiceTotal();
}

function recalculateInvoiceTotal() {
  const rows = document.querySelectorAll('.invoice-item-row');
  let subtotal = 0;

  rows.forEach(row => {
    const qty = Number(row.querySelector('.invoice-item-qty').value) || 0;
    const rate = Number(row.querySelector('.invoice-item-rate').value) || 0;
    const amount = qty * rate;

    row.querySelector('.invoice-item-amount').textContent = `$${amount.toFixed(2)}`;
    subtotal += amount;
  });

  document.getElementById('invoice-subtotal').textContent = subtotal.toFixed(2);
  document.getElementById('invoice-total').textContent = subtotal.toFixed(2);
}

function collectInvoiceData() {
  const rows = document.querySelectorAll('.invoice-item-row');

  const items = Array.from(rows).map(row => {
    const description = row.querySelector('.invoice-item-description').value.trim();
    const quantity = Number(row.querySelector('.invoice-item-qty').value) || 0;
    const rate = Number(row.querySelector('.invoice-item-rate').value) || 0;
    const amount = quantity * rate;

    return { description, quantity, rate, amount };
  }).filter(item => item.description);

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    invoiceNumber: document.getElementById('invoice-number').value.trim(),
    issueDate: document.getElementById('invoice-date').value,
    dueDate: document.getElementById('invoice-due-date').value,
    paidAt: document.getElementById('invoice-paid-at')?.value || '',
    clientId: document.getElementById('invoice-client').value || '',
    clientName: document.getElementById('invoice-client-name').value.trim(),
    clientEmail: document.getElementById('invoice-client-email').value.trim(),
    clientPhone: document.getElementById('invoice-client-phone').value.trim(),
    clientWebsite: document.getElementById('invoice-client-website').value.trim(),
    status: document.getElementById('invoice-status').value,
    notes: document.getElementById('invoice-notes').value.trim(),
    items,
    subtotal,
    total: subtotal
  };
}

async function saveInvoice() {
  try {
    const payload = collectInvoiceData();

    const url = currentInvoiceId
      ? `${apiBase}/invoices/${currentInvoiceId}`
      : `${apiBase}/invoices`;

    const method = currentInvoiceId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to save invoice');

    currentInvoiceId = data.invoice._id;
    await fetchInvoices();
    await fetchRevenueStats();
    if (currentClientId) {
      await openClient(currentClientId);
    }

    alert('Invoice saved successfully');
  } catch (err) {
    console.error('Save invoice error:', err);
    alert('Error saving invoice: ' + err.message);
  }
}
function newInvoice() {
  currentInvoiceId = null;

  document.getElementById('invoice-number').value = '';
  document.getElementById('invoice-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('invoice-due-date').value = '';
  document.getElementById('invoice-paid-at').value = '';
  document.getElementById('invoice-client').value = '';
  document.getElementById('invoice-client-name').value = '';
  document.getElementById('invoice-client-email').value = '';
  document.getElementById('invoice-client-phone').value = '';
  document.getElementById('invoice-client-website').value = '';
  document.getElementById('invoice-status').value = 'Draft';
document.getElementById('invoice-notes').value = userDefaultInvoiceTerms || DEFAULT_INVOICE_TERMS;
document.getElementById('invoice-items').innerHTML = '';

updatePaidDateVisibility();
addInvoiceItem();
recalculateInvoiceTotal();
clearSignature();
}
function buildInvoiceHTML() {
  const data = collectInvoiceData();

  return `
<div style="font-family: Arial, sans-serif; color: #111; background: #fff; padding: 30px; min-height: 1000px;">
      <h1 style="margin-bottom: 8px;">Invoice</h1>
      <p><strong>Invoice #:</strong> ${data.invoiceNumber || '-'}</p>
      <p><strong>Issue Date:</strong> ${data.issueDate || '-'}</p>
      <p><strong>Due Date:</strong> ${data.dueDate || '-'}</p>
      <p><strong>Status:</strong> ${data.status}</p>

      <hr>

      <h3>Bill To</h3>
      <p>${data.clientName || '-'}</p>
      <p>${data.clientEmail || ''}</p>
      <p>${data.clientPhone || ''}</p>
      <p>${data.clientWebsite || ''}</p>

      <hr>

      <table style="width:100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr>
            <th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Description</th>
            <th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Qty</th>
            <th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Rate</th>
            <th style="text-align:left; border-bottom:1px solid #ccc; padding:8px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(item => `
            <tr>
              <td style="padding:8px; border-bottom:1px solid #eee;">${item.description}</td>
              <td style="padding:8px; border-bottom:1px solid #eee;">${item.quantity}</td>
              <td style="padding:8px; border-bottom:1px solid #eee;">$${item.rate.toFixed(2)}</td>
              <td style="padding:8px; border-bottom:1px solid #eee;">$${item.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2 style="margin-top: 20px;">Total: $${data.total.toFixed(2)}</h2>

${data.notes ? `
  <div style="margin-top: 24px;">
    <h3 style="margin-bottom: 10px;">Terms & Notes</h3>
    <div style="white-space: pre-line; line-height: 1.6;">${data.notes}</div>
  </div>
` : ''}

    </div>
  `;
}

function downloadInvoicePDF() {
  try {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) throw new Error('jsPDF is not loaded');

    const data = collectInvoiceData();
    const signatureImage = getSignatureImage();

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'letter'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

    function ensureSpace(heightNeeded = 20) {
      if (y + heightNeeded > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    }

    function addText(text, x, yPos, options = {}) {
      const {
        size = 12,
        bold = false,
        color = [17, 17, 17],
        align = 'left',
        maxWidth = contentWidth
      } = options;

      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);

      if (align === 'right') {
        doc.text(String(text), x, yPos, { align: 'right', maxWidth });
      } else {
        doc.text(String(text), x, yPos, { maxWidth });
      }
    }

    function addWrappedText(text, options = {}) {
      const {
        size = 12,
        bold = false,
        color = [17, 17, 17],
        spacingAfter = 10
      } = options;

      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);

      const lines = doc.splitTextToSize(String(text || ''), contentWidth);
      const blockHeight = lines.length * (size + 3);

      ensureSpace(blockHeight);
      doc.text(lines, margin, y);
      y += blockHeight + spacingAfter;
    }

    function addDivider(spacing = 16) {
      ensureSpace(spacing);
      doc.setDrawColor(215, 215, 215);
      doc.line(margin, y, pageWidth - margin, y);
      y += spacing;
    }

    // Header
    doc.setFillColor(18, 18, 18);
    doc.roundedRect(margin, y, contentWidth, 92, 16, 16, 'F');

    addText('INVOICE', margin + 22, y + 30, {
      size: 24,
      bold: true,
      color: [255, 255, 255]
    });

    addText(`Invoice #: ${data.invoiceNumber || '-'}`, pageWidth - margin - 22, y + 28, {
      size: 11,
      color: [245, 245, 245],
      align: 'right'
    });

    addText(`Issue Date: ${data.issueDate || '-'}`, pageWidth - margin - 22, y + 48, {
      size: 11,
      color: [245, 245, 245],
      align: 'right'
    });

    addText(`Due Date: ${data.dueDate || '-'}`, pageWidth - margin - 22, y + 68, {
      size: 11,
      color: [245, 245, 245],
      align: 'right'
    });

    y += 120;

    // Bill To
    addWrappedText('Bill To', { size: 16, bold: true, spacingAfter: 8 });
    addWrappedText(data.clientName || '-', { spacingAfter: 4 });
    if (data.clientEmail) addWrappedText(data.clientEmail, { spacingAfter: 4 });
    if (data.clientPhone) addWrappedText(data.clientPhone, { spacingAfter: 4 });
    if (data.clientWebsite) addWrappedText(data.clientWebsite, { spacingAfter: 8 });

    addDivider();

    // Table headers
    const colX = [margin, margin + 260, margin + 330, margin + 430];
    addText('Description', colX[0], y, { size: 11, bold: true });
    addText('Qty', colX[1], y, { size: 11, bold: true });
    addText('Rate', colX[2], y, { size: 11, bold: true });
    addText('Amount', colX[3], y, { size: 11, bold: true });
    y += 10;

    doc.setDrawColor(190, 190, 190);
    doc.line(margin, y, pageWidth - margin, y);
    y += 18;

    // Table rows
    (data.items || []).forEach(item => {
      const descLines = doc.splitTextToSize(item.description || '', 240);
      const rowHeight = Math.max(22, descLines.length * 14);

      ensureSpace(rowHeight + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(17, 17, 17);

      doc.text(descLines, colX[0], y);
      doc.text(String(item.quantity ?? ''), colX[1], y);
      doc.text(`$${Number(item.rate || 0).toFixed(2)}`, colX[2], y);
      doc.text(`$${Number(item.amount || 0).toFixed(2)}`, colX[3], y);

      y += rowHeight;
      doc.setDrawColor(235, 235, 235);
      doc.line(margin, y - 6, pageWidth - margin, y - 6);
    });

    y += 10;

    // Total box
    ensureSpace(60);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(pageWidth - margin - 180, y, 180, 50, 12, 12, 'F');
    addText('Total', pageWidth - margin - 160, y + 20, { size: 12, bold: true });
    addText(`$${Number(data.total || 0).toFixed(2)}`, pageWidth - margin - 20, y + 20, {
      size: 18,
      bold: true,
      align: 'right'
    });
    y += 80;

    // Terms
    if (data.notes) {
      addWrappedText('Terms & Notes', { size: 16, bold: true, spacingAfter: 8 });
      addWrappedText(data.notes, { size: 11, spacingAfter: 20 });
    }

    // Signature
    ensureSpace(140);
    addWrappedText('Client Signature', { size: 14, bold: true, spacingAfter: 12 });

    if (signatureImage) {
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(margin, y, 240, 90, 10, 10);
      doc.addImage(signatureImage, 'PNG', margin + 10, y + 10, 220, 70);
      y += 110;
    } else {
      doc.setDrawColor(180, 180, 180);
      doc.line(margin, y + 40, margin + 240, y + 40);
      y += 60;
    }

    addText('Date: __________________________', margin, y, {
      size: 12
    });

    const filename = `${data.invoiceNumber || 'invoice'}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error('PDF error:', err);
    alert('Failed to generate PDF: ' + err.message);
  }
}
function updatePaidDateVisibility() {
  const statusEl = document.getElementById('invoice-status');
  const paidAtWrap = document.getElementById('invoice-paid-at-wrap');
  const paidAtEl = document.getElementById('invoice-paid-at');

  if (!statusEl || !paidAtWrap || !paidAtEl) return;

  if (statusEl.value === 'Paid') {
    paidAtWrap.style.display = 'block';

    if (!paidAtEl.value) {
      paidAtEl.value = new Date().toISOString().split('T')[0];
    }
  } else {
    paidAtWrap.style.display = 'none';
    paidAtEl.value = '';
  }
}

function handleInvoiceStatusChange() {
  updatePaidDateVisibility();
}

function printInvoice() {
  const printArea = document.getElementById('invoice-print');
  printArea.innerHTML = buildInvoiceHTML();

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head><title>Print Invoice</title></head>
      <body>${printArea.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

async function deleteInvoice() {
  if (!currentInvoiceId) return alert('No invoice selected');
  if (!confirm('Are you sure you want to delete this invoice?')) return;

  try {
    const res = await fetch(`${apiBase}/invoices/${currentInvoiceId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete invoice');
    }

    currentInvoiceId = null;

document.getElementById('invoice-number').value = '';
document.getElementById('invoice-date').value = '';
document.getElementById('invoice-due-date').value = '';
document.getElementById('invoice-paid-at').value = '';
document.getElementById('invoice-client').value = '';
document.getElementById('invoice-client-name').value = '';
document.getElementById('invoice-client-email').value = '';
document.getElementById('invoice-client-phone').value = '';
document.getElementById('invoice-client-website').value = '';
document.getElementById('invoice-status').value = 'Draft';
document.getElementById('invoice-notes').value = userDefaultInvoiceTerms || DEFAULT_INVOICE_TERMS;
document.getElementById('invoice-items').innerHTML = '';

updatePaidDateVisibility();
addInvoiceItem();
recalculateInvoiceTotal();
clearSignature();

    await fetchInvoices();
    await fetchRevenueStats();

    if (currentClientId) {
      await openClient(currentClientId);
    }

    alert('Invoice deleted successfully');
  } catch (err) {
    console.error('Delete invoice error:', err);
    alert('Error deleting invoice: ' + err.message);
  }
}
async function deleteSavedItem(id) {
  if (!confirm('Delete this saved line item?')) return;

  try {
    const res = await fetch(`${apiBase}/items/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete saved item');
    }

    await fetchSavedItems();
  } catch (err) {
    console.error('Delete saved item error:', err);
    alert('Error deleting saved item: ' + err.message);
  }
}
function useSavedItem(id) {
  const item = savedItems.find(i => i._id === id);
  if (!item) return;

  addInvoiceItem(item.name, 1, item.rate || 0);
}
function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatPercentChange(current, previous) {
  if (!previous) {
    return current > 0 ? 'New activity' : 'No change';
  }

  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

async function fetchRevenueStats() {
  try {
    const res = await fetch(`${apiBase}/stats/revenue`, {
      headers: getAuthHeaders()
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to load revenue stats');
    }

    revenueStats = data;
    renderRevenueCard();
    renderRevenueBreakdown();
  } catch (err) {
    console.error('Revenue stats error:', err);
  }
}

function renderRevenueCard() {
  if (!revenueStats) return;

  const totalEl = document.getElementById('revenue-total');
  const subtextEl = document.getElementById('revenue-subtext');

  if (totalEl) {
    totalEl.textContent = formatCurrency(revenueStats.thisMonthRevenue);
  }

  if (subtextEl) {
    subtextEl.textContent = `This Month • ${formatPercentChange(
      revenueStats.thisMonthRevenue,
      revenueStats.lastMonthRevenue
    )} vs last month`;
  }
}

function renderRevenueBreakdown() {
  if (!revenueStats) return;

  const summaryEl = document.getElementById('revenue-summary');
  const listEl = document.getElementById('revenue-breakdown-list');

  if (!summaryEl || !listEl) return;

  summaryEl.innerHTML = `
    <div class="card">
      <h3>This Month</h3>
      <p>${formatCurrency(revenueStats.thisMonthRevenue)}</p>
    </div>
    <div class="card">
      <h3>This Year</h3>
      <p>${formatCurrency(revenueStats.thisYearRevenue)}</p>
    </div>
    <div class="card">
      <h3>Outstanding</h3>
      <p>${formatCurrency(revenueStats.outstandingRevenue)}</p>
    </div>
    <div class="card">
      <h3>Paid Invoices</h3>
      <p>${revenueStats.paidInvoiceCount}</p>
    </div>
  `;

  if (revenueView === 'monthly') {
    listEl.innerHTML = revenueStats.monthlyBreakdown.map(item => `
      <div class="revenue-row">
        <span>${item.month}</span>
        <strong>${formatCurrency(item.revenue)}</strong>
      </div>
    `).join('');
  } else {
    listEl.innerHTML = revenueStats.yearlyBreakdown.map(item => `
      <div class="revenue-row">
        <span>${item.year}</span>
        <strong>${formatCurrency(item.revenue)}</strong>
      </div>
    `).join('');
  }
}

function toggleRevenueBreakdown() {
  const section = document.getElementById('revenue-breakdown');
  const arrow = document.getElementById('revenue-arrow');

  if (!section) return;

  const isOpen = section.style.display === 'block';
  section.style.display = isOpen ? 'none' : 'block';

  if (arrow) {
    arrow.textContent = isOpen ? '▼' : '▲';
  }
}

function setRevenueView(view) {
  revenueView = view;
  renderRevenueBreakdown();
}
// ---------------- INIT ----------------
function initSignaturePad() {
  const canvas = document.getElementById('signature-pad');
  if (!canvas) return;

  signaturePad = canvas;
  signatureCtx = canvas.getContext('2d');

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  signatureCtx.fillStyle = '#ffffff';
  signatureCtx.fillRect(0, 0, canvas.width, canvas.height);
  signatureCtx.strokeStyle = '#111111';
  signatureCtx.lineWidth = 2;
  signatureCtx.lineCap = 'round';
  signatureCtx.lineJoin = 'round';

  hasSignature = false;

  canvas.onmousedown = startSignature;
  canvas.onmousemove = drawSignature;
  canvas.onmouseup = endSignature;
  canvas.onmouseleave = endSignature;

  canvas.ontouchstart = startSignatureTouch;
  canvas.ontouchmove = drawSignatureTouch;
  canvas.ontouchend = endSignature;
}

function getSignaturePos(e) {
  const rect = signaturePad.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function startSignature(e) {
  if (!signatureCtx) return;
  isDrawingSignature = true;
  const pos = getSignaturePos(e);
  signatureCtx.beginPath();
  signatureCtx.moveTo(pos.x, pos.y);
}

function drawSignature(e) {
  if (!isDrawingSignature || !signatureCtx) return;
  const pos = getSignaturePos(e);
  signatureCtx.lineTo(pos.x, pos.y);
  signatureCtx.stroke();
  hasSignature = true;
}

function startSignatureTouch(e) {
  e.preventDefault();
  if (!signatureCtx || !e.touches.length) return;
  isDrawingSignature = true;
  const touch = e.touches[0];
  const pos = getSignaturePos(touch);
  signatureCtx.beginPath();
  signatureCtx.moveTo(pos.x, pos.y);
}

function drawSignatureTouch(e) {
  e.preventDefault();
  if (!isDrawingSignature || !signatureCtx || !e.touches.length) return;
  const touch = e.touches[0];
  const pos = getSignaturePos(touch);
  signatureCtx.lineTo(pos.x, pos.y);
  signatureCtx.stroke();
  hasSignature = true;
}

function endSignature() {
  isDrawingSignature = false;
}

function clearSignature() {
  if (!signaturePad || !signatureCtx) return;
  signatureCtx.clearRect(0, 0, signaturePad.width, signaturePad.height);
  signatureCtx.fillStyle = '#ffffff';
  signatureCtx.fillRect(0, 0, signaturePad.width, signaturePad.height);
  signatureCtx.strokeStyle = '#111111';
  signatureCtx.lineWidth = 2;
  signatureCtx.lineCap = 'round';
  signatureCtx.lineJoin = 'round';
  hasSignature = false;
}

function getSignatureImage() {
  if (!signaturePad || !hasSignature) return null;
  return signaturePad.toDataURL('image/png');
}
async function init() {
  document.getElementById('clients-list')?.addEventListener('click', handleClientActions);
  document.getElementById('referrals-list')?.addEventListener('click', handleReferralActions);
  document.getElementById('profile-projects')?.addEventListener('click', handleProjectActions);
document.getElementById('invoice-status')?.addEventListener('change', handleInvoiceStatusChange);
  await fetchDefaultInvoiceTerms();

  fetchClients();
  fetchReferrals();
  fetchTodos();
  fetchEvents();
  updateStats();
  initCalendar();
  fetchClientsForInvoice();
  fetchInvoices();
  fetchSavedItems();
  initSignaturePad();
  fetchRevenueStats();
  updatePaidDateVisibility();

  

  if (document.getElementById('invoice-items') && !document.querySelector('.invoice-item-row')) {
    addInvoiceItem();
  }

  const invoiceDate = document.getElementById('invoice-date');
  if (invoiceDate && !invoiceDate.value) {
    invoiceDate.value = new Date().toISOString().split('T')[0];
  }

  const invoiceNotes = document.getElementById('invoice-notes');
  if (invoiceNotes && !invoiceNotes.value) {
    invoiceNotes.value = userDefaultInvoiceTerms || DEFAULT_INVOICE_TERMS;
  }
}

document.addEventListener('DOMContentLoaded', init);

// ---------------- GLOBALS ----------------
window.addClient = addClient;
window.addReferral = addReferral;
window.editReferral = editReferral;
window.deleteReferral = deleteReferral;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.saveNotes = saveNotes;
window.addProject = addProject;
window.editProject = editProject;
window.deleteProject = deleteProject;
window.closeProfile = closeProfile;
window.loadDailyVerse = loadDailyVerse;
window.addTodo = addTodo;
window.toggleTodo = toggleTodo;
window.deleteTodo = deleteTodo;
window.editTodoInline = editTodoInline;
window.enableTodoDragAndDrop = enableTodoDragAndDrop;
window.fetchClientsForInvoice = fetchClientsForInvoice;
window.autofillInvoiceClient = autofillInvoiceClient;
window.addInvoiceItem = addInvoiceItem;
window.removeInvoiceItem = removeInvoiceItem;
window.recalculateInvoiceTotal = recalculateInvoiceTotal;
window.saveInvoice = saveInvoice;
window.downloadInvoicePDF = downloadInvoicePDF;
window.printInvoice = printInvoice;
window.fetchInvoices = fetchInvoices;
window.loadInvoice = loadInvoice;
window.deleteInvoice = deleteInvoice;
window.deleteSavedItem = deleteSavedItem;
window.useSavedItem = useSavedItem;
window.newInvoice = newInvoice;
window.saveDefaultTerms = saveDefaultTerms;
window.resetDefaultTerms = resetDefaultTerms;
window.clearSignature = clearSignature;
window.toggleRevenueBreakdown = toggleRevenueBreakdown;
window.setRevenueView = setRevenueView;
window.handleInvoiceStatusChange = handleInvoiceStatusChange;