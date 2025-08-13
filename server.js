const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const nodemailer = require('nodemailer');

app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));

let reservedNumbers = new Map(); // number -> { buyer, paymentMethod, expiresAt }
let adminBlocked = new Map();     // number -> { note, blockedAt }

// Nodemailer config (example: Gmail SMTP, adjust with real account)
const transporter = nodemailer.createTransport({
  service:'gmail',
  auth:{ user:'YOUR_EMAIL@gmail.com', pass:'YOUR_PASSWORD' }
});

// API: get numbers
app.get('/api/numbers',(req,res)=>{
  const data = [];
  for(let i=0;i<=999;i++){
    if(reservedNumbers.has(i) || adminBlocked.has(i)) data.push({number:i,status:'reserved'});
    else data.push({number:i,status:'available'});
  }
  res.json(data);
});

// API: reserve numbers after payment
app.post('/api/reserve', async (req,res)=>{
  const { numbers, buyer, paymentMethod, email } = req.body;
  const unavailable = numbers.filter(n=>reservedNumbers.has(n) || adminBlocked.has(n));
  if(unavailable.length>0) return res.status(400).json({unavailable});

  const expiresAt = Date.now() + 20*60*1000; // 20 min
  numbers.forEach(n=>{
    reservedNumbers.set(n,{buyer,paymentMethod,expiresAt});
  });

  io.emit('numbers:update',numbers.map(n=>({number:n,status:'reserved'})));

  // Send confirmation email
  let message='';
  if(paymentMethod==='Zelle') message='Thank you for your purchase. Good luck';
  if(paymentMethod==='Pix') message='Obrigado pela sua compra. Boa sorte';
  if(paymentMethod==='Nequi') message='Gracias por su compra. Buena suerte';

  try{
    await transporter.sendMail({
      from:'YOUR_EMAIL@gmail.com',
      to: email,
      subject:'Bingo Purchase Confirmation',
      text: message
    });
  } catch(e){ console.log('Email error:',e); }

  res.json({ reserved:numbers });
});

// Admin block
app.post('/api/admin/block',(req,res)=>{
  const { number, note } = req.body;
  if(number<0 || number>999) return res.status(400).json({error:'Invalid number'});
  adminBlocked.set(number,{note,blockedAt:new Date()});
  reservedNumbers.set(number,{buyer:{firstName:'ADMIN',lastName:'BLOCKED'},paymentMethod:'CASH',expiresAt:Infinity});
  io.emit('numbers:update',[{number,status:'reserved'}]);
  res.json({ok:true});
});

app.get('/api/admin/blocked',(req,res)=>res.json(Array.from(adminBlocked.entries())));

const PORT = process.env.PORT || 3000;
http.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
