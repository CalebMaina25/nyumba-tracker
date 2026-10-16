const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const path = require('path');
const app = express();

app.use(express.json());
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

// PERSISTENT DB - File stays on Render if you add a Disk (free)
const db = new sqlite3.Database('./nyumba.db'); // NOT :memory:

db.serialize(() => {
  // Landlords table - each landlord sees only his tenants
  db.run(`CREATE TABLE IF NOT EXISTS landlords (
    id INTEGER PRIMARY KEY, phone TEXT UNIQUE, name TEXT, password TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tenants (
    id INTEGER PRIMARY KEY, landlord_id INTEGER, name TEXT, phone TEXT, house TEXT, rent INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY, landlord_id INTEGER, tenant_id INTEGER, amount INTEGER, mpesa_code TEXT UNIQUE, date TEXT
  )`);
});

// Simple Auth - No JWT stress for MVP
app.post('/api/signup', (req,res)=>{
  const {name, phone, password} = req.body;
  db.run("INSERT INTO landlords (name,phone,password) VALUES (?,?,?)", [name, phone, password], function(err){
    if(err) return res.status(400).json({error:"Phone already used"});
    res.json({id:this.lastID, name, phone});
  });
});
app.post('/api/login', (req,res)=>{
  const {phone, password} = req.body;
  db.get("SELECT * FROM landlords WHERE phone=? AND password=?", [phone, password], (e,row)=>{
    if(!row) return res.status(401).json({error:"Wrong phone/password"});
    res.json(row);
  });
});

app.get('/api/tenants/:landlord_id', (req,res)=>{
  db.all("SELECT * FROM tenants WHERE landlord_id=? ORDER BY id DESC", [req.params.landlord_id], (e,rows)=>res.json(rows||[]));
});
app.post('/api/tenants', (req,res)=>{
  const {landlord_id, name, phone, house, rent} = req.body;
  db.run("INSERT INTO tenants (landlord_id,name,phone,house,rent) VALUES (?,?,?,?,?)", [landlord_id, name, phone, house, rent], function(){res.json({ok:true, id:this.lastID});});
});

app.post('/api/parse-mpesa', (req,res)=>{ res.json(parseText(req.body.text)); });
app.post('/api/upload-pdf', upload.single('pdf'), async (req,res)=>{
  try{ const data = await pdfParse(req.file.buffer); res.json(parseText(data.text)); }
  catch(e){ res.status(500).json({error:e.message}); }
});

function parseText(text){
  if(!text) return [];
  const results=[]; const regex=/([A-Z0-9]{10}).{0,40}?Ksh\s?([\d,]+\.?\d*).*?(\d{7,12})?/gi; let m;
  while((m=regex.exec(text))!==null){
    const code=m[1].toUpperCase();
    if(results.find(r=>r.code===code)) continue;
    results.push({code, amount:parseInt((m[2]||"0").replace(/,/g,'')), phone:m[3]||"Till", status:"REAL ✅"});
  } return results;
}

app.use(express.static(path.join(__dirname,'../frontend')));
app.get('*', (req,res)=>res.sendFile(path.join(__dirname,'../frontend/index.html')));
app.listen(process.env.PORT||3000, ()=>console.log("NyumbaTracker PERSISTENT running"));

