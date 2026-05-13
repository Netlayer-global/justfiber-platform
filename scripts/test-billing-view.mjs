import {connectMongo} from '../src/db/mongoose.js';
import {CustomerUser} from '../src/models/CustomerUser.js';
import jwt from 'jsonwebtoken';
import {env} from '../src/config/env.js';

await connectMongo();
const user = await CustomerUser.findOne({mobile: /9315151666/});
if (!user) { console.log('User not found'); process.exit(1); }
const token = jwt.sign({sub: user._id.toString(), scope: 'customer'}, env.JWT_ACCESS_SECRET || env.JWT_SECRET, {expiresIn: '1h'});

// Test the /view endpoint (what the app actually calls)
const res = await fetch('http://localhost:4000/api/v1/customer/billing/jaze/view', {
  headers: { 'Authorization': 'Bearer ' + token }
});
const data = await res.json();
console.log('Status:', res.status);
console.log('Has summary:', !!data?.data?.summary);
console.log('Invoices count:', data?.data?.invoices?.length || 0);
console.log('Payment link:', data?.data?.payment?.paymentLink ? 'YES' : 'NO');
console.log('');
console.log('Full response:', JSON.stringify(data).slice(0, 600));
process.exit(0);
