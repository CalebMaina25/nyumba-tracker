let tenants = JSON.parse(localStorage.getItem('nyumba_tenants') || '[]');
let currentFilter = 'all';

const nameInput = document.getElementById('nameInput');
const houseInput = document.getElementById('houseNoInput');
const phoneInput = document.getElementById('phoneInput');
const rentInput = document.getElementById('rentInput');
const addBtn = document.getElementById('addTenantBtn');
const listEl = document.getElementById('tenantsList');
const searchInput = document.getElementById('searchInput');
const excelFile = document.getElementById('excelFile');
const uploadBtn = document.getElementById('uploadExcelBtn');

// STATS
function updateStats(){
  const total = tenants.length;
  const totalRent = tenants.reduce((s,t)=> s + (Number(t.rent)||0),0);
  document.getElementById('totalTenants').innerText = total;
  document.getElementById('totalRent').innerText = 'KES ' + totalRent.toLocaleString();
  // for now collected = 0, you will add paid logic later
  document.getElementById('collected').innerText = 'KES 0';
  document.getElementById('due').innerText = 'KES ' + totalRent.toLocaleString();
}

// RENDER
function render(){
  const q = (searchInput?.value || '').toLowerCase();
  let filtered = tenants.filter(t => 
    t.name.toLowerCase().includes(q) || 
    t.houseNo.toLowerCase().includes(q) || 
    t.phone.includes(q)
  );
  if(filtered.length===0){
    listEl.innerHTML = `<p style="color:#999;font-size:13px;text-align:center;padding:20px">No tenants found</p>`;
  } else {
    listEl.innerHTML = filtered.map((t,i)=>`
      <div class="tenant">
        <div>
          <b>${t.name}</b> <small style="color:#888">- ${t.houseNo}</small><br>
          <small>📞 ${t.phone} • KES ${t.rent}</small>
        </div>
        <div>
          <span class="badge badge-off">Offline</span><br>
          <button onclick="deleteTenant(${tenants.indexOf(t)})" style="margin-top:6px;font-size:11px;border:none;background:#ffeaea;color:red;border-radius:6px;padding:4px 8px">Delete</button>
        </div>
      </div>
    `).join('');
  }
  updateStats();
  localStorage.setItem('nyumba_tenants', JSON.stringify(tenants));
}

window.deleteTenant = (idx)=>{
  if(confirm('Delete this tenant?')){
    tenants.splice(idx,1);
    render();
  }
}
window.filterTenants = (type)=>{
  currentFilter = type;
  render();
}

// ADD SINGLE
addBtn?.addEventListener('click', ()=>{
  const t = {
    name: nameInput.value.trim(),
    houseNo: houseInput.value.trim(),
    phone: phoneInput.value.trim(),
    rent: rentInput.value.trim(),
    status: 'offline'
  };
  if(!t.name || !t.houseNo){ alert('Name and House No required'); return; }
  tenants.push(t);
  nameInput.value=''; houseInput.value=''; phoneInput.value=''; rentInput.value='';
  render();
  alert('Tenant added: ' + t.name);
});

searchInput?.addEventListener('input', render);

// --- EXCEL UPLOAD - THIS WAS MISSING ---
uploadBtn?.addEventListener('click', ()=>{
  const file = excelFile.files[0];
  if(!file){ alert('Choose Excel file first'); return; }
  
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, {type:'array'});
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {defval:''});
      
      if(rows.length===0){ alert('Excel is empty'); return; }
      
      let added = 0;
      rows.forEach(r=>{
        // Auto-detect column names (case insensitive)
        const get = (keys)=>{
          for(let k in r){
            if(keys.includes(k.toLowerCase().trim())) return r[k];
          }
          return '';
        };
        const name = get(['name','tenant','full name','jina']);
        const houseNo = get(['house no','house','house number','unit','house_no','houseno']);
        const phone = get(['phone','mobile','tel','telephone','phone number']);
        const rent = get(['rent','amount','monthly','ksh']);
        
        if(name){
          tenants.push({
            name: String(name).trim(),
            houseNo: String(houseNo||'').trim(),
            phone: String(phone||'').trim(),
            rent: String(rent||0).trim(),
            status: 'offline'
          });
          added++;
        }
      });
      
      render();
      alert(`Success! ${added} tenants added from Excel`);
      excelFile.value = '';
    }catch(err){
      console.error(err);
      alert('Failed to read Excel. Make sure columns are Name, House No, Phone, Rent');
    }
  };
  reader.readAsArrayBuffer(file);
});

// init
render();
document.getElementById('onlineStatus')?.classList.add('online');
document.getElementById('onlineStatus').innerText = 'Online - Synced';

// online check
setInterval(()=>{
  const el = document.getElementById('onlineStatus');
  if(navigator.onLine){ el.innerText='Online - Synced'; el.className='status online'; }
  else { el.innerText='Offline - Saved locally'; el.className='status'; }
}, 3000);