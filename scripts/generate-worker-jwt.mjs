import crypto from 'node:crypto';

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!privateKey) {
  console.error('Missing JWT_PRIVATE_KEY env var');
  process.exit(1);
}

const nowSeconds = Math.floor(Date.now() / 1000);
const expiresInSeconds = 60 * 60 * 24 * 365;

const header = {
  alg: 'RS256',
  typ: 'JWT',
};

const payload = {
  sub: 'worker',
  role: 'Admin',
  iat: nowSeconds,
  exp: nowSeconds + expiresInSeconds,
};

const encodedHeader = base64url(JSON.stringify(header));
const encodedPayload = base64url(JSON.stringify(payload));
const data = `${encodedHeader}.${encodedPayload}`;

const signature = crypto
  .createSign('RSA-SHA256')
  .update(data)
  .end()
  .sign(privateKey);

const token = `${data}.${base64url(signature)}`;

console.log(token);
