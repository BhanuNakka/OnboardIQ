import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../src/models/User.js';
import { connectDatabase } from '../src/config/db.js';

await connectDatabase();
const passwordHash = await bcrypt.hash('DemoPass123!', 12);
const users = [
  ['Demo Customer', 'customer@onboardiq.test', 'CUSTOMER'], ['Demo Maker', 'maker@onboardiq.test', 'MAKER'],
  ['Demo Checker', 'checker@onboardiq.test', 'CHECKER'], ['Demo Compliance', 'compliance@onboardiq.test', 'COMPLIANCE'], ['Demo Admin', 'admin@onboardiq.test', 'ADMIN']
];
for (const [name, email, role] of users) await User.updateOne({ email }, { $set: { name, email, role, passwordHash } }, { upsert: true });
console.log('Demo users seeded. Development password: DemoPass123!');
await mongoose.disconnect();
