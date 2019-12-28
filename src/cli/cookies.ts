import crypto from 'crypto';
import { CookieJar } from 'tough-cookie';

function decodeCookie({ encoded, password, iv }: { encoded: string; password: string; iv: Buffer }): CookieJar {
  try {
    const key = Buffer.from(
      crypto
        .createHash('sha256')
        .update(password, 'utf8')
        .digest('base64'),
      'base64',
    );
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decoded = [decipher.update(encoded, 'base64', 'utf8'), decipher.final('utf8')].join('');
    return CookieJar.fromJSON(decoded);
  } catch (err) {
    return new CookieJar();
  }
}

function encodeCookie({ jar, password }: { jar: CookieJar; password: string }): { encoded: string; iv: Buffer } {
  const key = Buffer.from(
    crypto
      .createHash('sha256')
      .update(password, 'utf8')
      .digest('base64'),
    'base64',
  );
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const cookie = JSON.stringify(jar.toJSON());
  const encoded = [cipher.update(cookie, 'utf8', 'base64'), cipher.final('base64')].join('');
  return { encoded, iv };
}

export { encodeCookie, decodeCookie };
