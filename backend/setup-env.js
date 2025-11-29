import crypto from 'crypto';
import fs from 'fs';

const jwtSecret = crypto.randomBytes(64).toString('hex');
const encryptionKey = crypto.randomBytes(32).toString('hex');

const envContent = `PORT=3000
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=24h
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ENCRYPTION_KEY=${encryptionKey}
NODE_ENV=development
`;

fs.writeFileSync('.env', envContent);

console.log('✅ .env file created successfully!');
console.log('\nGenerated secrets:');
console.log(`JWT_SECRET: ${jwtSecret}`);
console.log(`ENCRYPTION_KEY: ${encryptionKey}`);
console.log('\nDefault credentials:');
console.log('Username: admin');
console.log('Password: admin123');
console.log('\n⚠️  Change the password in production!');
