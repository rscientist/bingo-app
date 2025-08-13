const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store reserved numbers
let reservedNumbers = new Map(); // number -> { buyer, paymentMethod, expiresAt }
// Store admin-blocked numbers
let adminBlocked = new Map(); // number -> { note, blockedAt }

// Get all numbers for frontend
app.get('/api/numbers', (req,res)=>{
  const data = [];
  for(let i=0;i<=999;i++){
    if(reservedNumbers.has(i) || adminBlocked.has(i)) data.push({ number:i,status:'reserved' });
    else data.push({ number:i,status:'available' });
  }
  res.json(data);
});

// Reserve numbers (called when real payment is confirmed)
app.post('/api/reserve',(req,res)=>{
  const { numbers, buyer, paymentMethod } = req.body;
  const unavailable = numbers.filter(n=>reservedNumbers.has(n) || adminBlocked.has(n));
  if(unavailable.length>0) return res.status(400).json({ unavailable });

  const expiresAt = Date.now() + 20*60*1000; // 20 min
  numbers.forEach(n=>reservedNumbers.set(n,{ buyer, paymentMethod, expiresAt }));
  io.emit('numbers:update',numbers.map(n=>({ number:n, status:'reserved' })));

  res.json({ reserved: numbers });
});

// Admin block number
app.post('/api/admin/block', (req,res)=>{
  const { number, note } = req.body;
  if(number < 0 || number > 999) return res.status(400).json({ error:'Invalid number' });

  adminBlocked.set(number,{ note, blockedAt: new Date() });
  reservedNumbers.set(number,{ buyer:{ firstName:'ADMIN', lastName:'BLOCKED' }, paymentMethod:'CASH', expiresAt: Infinity });
  io.emit('numbers:update', [{ number, status:'reserved' }]);
  res.json({ ok:true });
});

// Optionally: get all blocked numbers for admin view
app.get('/api/admin/blocked', (req,res)=>{
  res.json(Array.from(adminBlocked.entries()));
});

// Start server
const PORT = process.env.PORT || 3000;
http.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
