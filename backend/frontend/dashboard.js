// ================= DASHBOARD.JS =================
const apiBase = 'https://beyondflow-production.up.railway.app';

// ---------------- STATE ----------------
let currentClientId = (localStorage.getItem('currentClientId')) || null;
let currentInvoiceId = null;
let invoiceClients = [];

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}
// ---------------- CLIENTS ----------------
async function fetchClients() {
  try {
const res = await fetch(`${apiBase}/clients`, {
  headers: getAuthHeaders()
});

if (!res.ok) throw new Error('Failed to load clients');
    const clients = await res.json();

    // Get sort option
    const sortOption = document.getElementById('client-sort').value;

    // Sort based on option
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

    const clients = await res.json();
    const client = clients.find(c => c._id === id);
    if (!client) return alert('Client not found');

    const newName = prompt('Edit name:', client.name);
    const newPhone = prompt('Edit phone:', client.phone);
    const newEmail = prompt('Edit email:', client.email);
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

    await fetchClients();
    await updateStats();

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
    const clients = await res.json();

    if (!clients.length) return alert('No clients to export.');

    // Create CSV content
const headers = ['ID', 'Name', 'Phone', 'Email', 'Website', 'Status', 'Notes'];
const rows = clients.map(c => [c._id, c.name, c.phone, c.email, c.website || '', c.status, c.notes]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');

    // Download as file
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
  
  // First line is header, detect its columns
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = lines.slice(1);

  for (const row of rows) {
    const cols = row.split(',').map(c => c.trim());
    // Map columns based on header names
    const clientData = {
      name: cols[headers.indexOf('name')] || '',
      phone: cols[headers.indexOf('phone')] || '',
      email: cols[headers.indexOf('email')] || '',
      status: cols[headers.indexOf('status')] || 'Lead',
      notes: cols[headers.indexOf('notes')] || '',
      website: cols[headers.indexOf('website')] || '',
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
}

// Make them global for HTML buttons
window.exportClientsCSV = exportClientsCSV;
window.importClientsCSV = importClientsCSV;
// ---------------- REFERRALS ----------------
async function fetchReferrals() {
  try {
const res = await fetch(`${apiBase}/referrals`, {
  headers: getAuthHeaders()
});
    const referrals = await res.json();

    const sortOption = document.getElementById('referral-sort').value;

    referrals.sort((a, b) => {
      switch (sortOption) {
        case 'referrer-asc': return a.referrer.localeCompare(b.referrer);
        case 'referrer-desc': return b.referrer.localeCompare(a.referrer);
        case 'credit': return (a.credit || 0) - (b.credit || 0);
        default: return 0;
      }
    });

    const list = document.getElementById('referrals-list');
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
// ---------------- EDIT REFERRAL ----------------
async function editReferral(id) {
  try {
const res = await fetch(`${apiBase}/referrals`, {
  headers: getAuthHeaders()
});
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

// ---------------- DELETE REFERRAL ----------------
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

// Make global so HTML onclick can access
window.editReferral = editReferral;
window.deleteReferral = deleteReferral;

async function addProject() {
  if (!currentClientId) {
    return alert('No client selected');
  }

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

    // Clear inputs
    document.getElementById('project-name').value = '';
    document.getElementById('project-description').value = '';
    document.getElementById('project-price').value = '';
    document.getElementById('project-started').value = '';
    document.getElementById('project-ended').value = '';

    // Reload client profile so new project shows
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

    await openClient(clientId); // refresh UI

  } catch (err) {
    console.error('Delete project error:', err);
    alert('Error deleting project: ' + err.message);
  }
}
async function editProject(clientId, projectId) {
  try {
    // Get latest client data
const res = await fetch(`${apiBase}/clients`, {
  headers: getAuthHeaders()
});
    const clients = await res.json();
    const client = clients.find(c => c._id === clientId);
    const project = client?.projects?.find(p => p.id === projectId);

    if (!project) return alert('Project not found');

    // Prompt edits
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

    await openClient(clientId); // refresh UI

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
// ---------------- CLOSE CLIENT PROFILE ----------------
function closeProfile() {
  const profile = document.getElementById('client-profile');
  profile.style.display = 'none';
  currentClientId = null;
  localStorage.removeItem('currentClientId');

  // Optional: clear input fields
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
// ---------------- SAVE CLIENT STATUS ----------------
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

    await fetchClients(); // refresh client list
    await updateStats();  // refresh stats
    alert('Status saved!');
  } catch (err) {
    console.error('Save status error:', err);
    alert('Error saving status: ' + err.message);
  }
}

// Make it globally accessible for HTML
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
let draggedTodoId = null;

async function fetchTodos() {
const res = await fetch(`${apiBase}/todos`, {
  headers: getAuthHeaders()
});
  const todos = await res.json();

  todos.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  window.todos = todos;

  const list = document.getElementById('todo-list');

  list.innerHTML = todos.map(t => `
    <li data-id="${t._id}" draggable="true" style="display:flex; align-items:center; gap:10px;">
      <input type="checkbox" ${t.completed ? 'checked' : ''} 
        onchange="toggleTodo('${t._id}', this.checked)">
      <span contenteditable="true" onblur="editTodoInline('${t._id}', this)" 
        style="${t.completed ? 'text-decoration: line-through;' : ''}">
        ${t.text}
      </span>
      <button onclick="deleteTodo('${t._id}')">❌</button>
    </li>
  `).join('');

  enableTodoDragAndDrop();
}

// ---------------- ADD TODO ----------------
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
  fetchTodos();
}

// ---------------- TOGGLE ----------------
async function toggleTodo(id, completed) {
  await fetch(`${apiBase}/todos/${id}`, {
    method: 'PUT',
headers: getAuthHeaders(),
    body: JSON.stringify({ completed })
  });
}

// ---------------- DELETE ----------------
async function deleteTodo(id) {
  try {
const res = await fetch(`${apiBase}/todos/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders()
});
    if (!res.ok) throw new Error('Failed to delete todo');

    // Remove from UI immediately
    const li = document.querySelector(`#todo-list li[data-id="${id}"]`);
    if (li) li.remove();

    // Optional: refresh list from server
    // await fetchTodos();

  } catch (err) {
    console.error('Delete todo error:', err);
    alert('Error deleting todo: ' + err.message);
  }
}

// ---------------- INLINE EDIT ----------------
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

    // ✅ Update UI
    spanElement.textContent = data.todo.text;

    // ✅ Update local todos array if you have one
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

  console.log('CLEAN ORDER:', newOrder);

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
let calendar;

function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;

  if (calendar) {
    calendar.destroy();
  }

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

      const action = prompt(
        `Edit or Delete this event?\nType "edit" to edit, "delete" to delete.`
      );

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
        openClient(currentClientId);
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
  // Find the client
const res = await fetch(`${apiBase}/clients`, {
  headers: getAuthHeaders()
});
  const clients = await res.json();
  const client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
  if (!client) return; // client not found

  // Add event to profile schedule list
  const profileEventsEl = document.getElementById('profile-events');
  if (!profileEventsEl) {
    // create container if missing
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
// Fetch events from backend
async function fetchEvents() {
  try {
const res = await fetch(`${apiBase}/events`, {
  headers: getAuthHeaders()
});
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

// Delete event by ID
async function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;

  try {
const res = await fetch(`${apiBase}/events/${id}`, {
  method: 'DELETE',
  headers: getAuthHeaders()
});
    if (!res.ok) throw new Error('Failed to delete event');
    await fetchEvents();
  } catch(err) {
    console.error('Delete event error:', err);
  }
}

// make global
window.initCalendar = initCalendar;
window.addEvent = addEvent;
window.fetchEvents = fetchEvents;
window.deleteEvent = deleteEvent;

async function fetchInvoices() {
  try {
const res = await fetch(`${apiBase}/invoices`, {
  headers: getAuthHeaders()
});
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
async function loadInvoice(id) {
  try {
const res = await fetch(`${apiBase}/invoices`, {
  headers: getAuthHeaders()
});
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
function autofillInvoiceClient() {
  const clientId = document.getElementById('invoice-client').value;
  const client = invoiceClients.find(c => c._id === clientId);
  if (!client) return;

  document.getElementById('invoice-client-name').value = client.name || '';
  document.getElementById('invoice-client-email').value = client.email || '';
  document.getElementById('invoice-client-phone').value = client.phone || '';
  document.getElementById('invoice-client-website').value = client.website || '';
}

function addInvoiceItem(description = '', quantity = 1, rate = 0) {
  const container = document.getElementById('invoice-items');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'invoice-item-row';
  row.innerHTML = `
    <input type="text" class="invoice-item-description" placeholder="Service / Item" value="${description}">
    <input type="number" class="invoice-item-qty" placeholder="Qty" value="${quantity}" min="1" step="1">
    <input type="number" class="invoice-item-rate" placeholder="Rate" value="${rate}" min="0" step="0.01">
    <span class="invoice-item-amount">$0.00</span>
    <button type="button" onclick="removeInvoiceItem(this)">Remove</button>
  `;

  container.appendChild(row);

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

if (currentClientId) {
  await openClient(currentClientId);
}

alert('Invoice saved successfully');
} catch (err) {
    console.error('Save invoice error:', err);
    alert('Error saving invoice: ' + err.message);
  }
  
}

function buildInvoiceHTML() {
  const data = collectInvoiceData();

  return `
    <div style="font-family: Arial, sans-serif; color: #111; padding: 30px;">
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

      ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
    </div>
  `;
}

function downloadInvoicePDF() {
  const printArea = document.getElementById('invoice-print');
  printArea.innerHTML = buildInvoiceHTML();
  printArea.style.display = 'block';

  html2pdf().set({
    margin: 0.5,
    filename: `${document.getElementById('invoice-number').value || 'invoice'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  }).from(printArea).save().then(() => {
    printArea.style.display = 'none';
  });
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
    document.getElementById('invoice-client').value = '';
    document.getElementById('invoice-client-name').value = '';
    document.getElementById('invoice-client-email').value = '';
    document.getElementById('invoice-client-phone').value = '';
    document.getElementById('invoice-client-website').value = '';
    document.getElementById('invoice-status').value = 'Draft';
    document.getElementById('invoice-notes').value = '';
    document.getElementById('invoice-items').innerHTML = '';
    addInvoiceItem();
    recalculateInvoiceTotal();

    await fetchInvoices();

    if (currentClientId) {
      await openClient(currentClientId);
    }

    alert('Invoice deleted successfully');
  } catch (err) {
    console.error('Delete invoice error:', err);
    alert('Error deleting invoice: ' + err.message);
  }
}
// ---------------- INIT ----------------
function init() {
  // Only attach event listeners for dynamically generated elements
  document.getElementById('clients-list')?.addEventListener('click', handleClientActions);
  document.getElementById('referrals-list')?.addEventListener('click', handleReferralActions);
  document.getElementById('profile-projects')?.addEventListener('click', handleProjectActions);

  // Fetch data immediately
  fetchClients();
  fetchReferrals();
  fetchTodos();
  fetchEvents();
  updateStats();
  initCalendar();
  fetchClientsForInvoice();
  fetchInvoices();

if (document.getElementById('invoice-items') && !document.querySelector('.invoice-item-row')) {
  addInvoiceItem();
}

const invoiceDate = document.getElementById('invoice-date');
if (invoiceDate && !invoiceDate.value) {
  invoiceDate.value = new Date().toISOString().split('T')[0];
}
}

// Run init on page load
document.addEventListener('DOMContentLoaded', init);
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