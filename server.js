const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let reservedNumbers = new Map();

app.get('/api/numbers', (req,res)=>{
  const data = [];
  for(let i=0;i<=999;i++){
    if(reservedNumbers.has(i)) data.push({ number:i,status:'reserved' });
    else data.push({ number:i,status:'available' });
  }
  res.json(data);
});

app.post('/api/reserve',(req,res)=>{
  const { numbers, buyer, paymentMethod } = req.body;
  const unavailable = numbers.filter(n=>reservedNumbers.has(n));
  if(unavailable.length>0) return res.status(400).json({ unavailable });

  const expiresAt = Date.now() + 20*60*1000; // 20 minutes
  numbers.forEach(n=>reservedNumbers.set(n,{expiresAt,buyer,paymentMethod}));
  io.emit('numbers:update',numbers.map(n=>({number:n,status:'reserved'})));

  res.json({
    reservationId: Math.random().toString(36).slice(2,10),
    reserved: numbers,
    payment:{ provider:paymentMethod, amount:1, currency:'USD', qrData:'DEMO_QR' },
    expiresAt
  });
});

http.listen(process.env.PORT || 3000, ()=>console.log('Server running'));
