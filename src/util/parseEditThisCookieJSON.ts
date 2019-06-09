import * as tough from 'tough-cookie';
import * as fs from 'fs-extra';

interface EditThisCookieEntity {
  domain: string;
  expirationDate: number;
  httpOnly: boolean;
  hostOnly: boolean;
  name: string;
  path: string;
  sameSite: string;
  secure: boolean;
  session: boolean;
  storeId: string;
  value: string;
  id: number;
}

export default async function parseEditThisCookieJSON(filePath: string) {
  const jsonStr = await fs.readFile(filePath, 'utf8');
  const data: EditThisCookieEntity[] = JSON.parse(jsonStr);

  const mapped = data.map((entity) => {
    return new tough.Cookie({
      expires: new Date(entity.expirationDate * 1000),
      domain: entity.domain.replace(/^\./, ''),
      hostOnly: entity.hostOnly,
      httpOnly: entity.hostOnly,
      key: entity.name,
      path: entity.path,
      secure: entity.secure,
      value: entity.value,
    });
  });

  return tough.CookieJar.fromJSON(
    JSON.stringify({
      version: 'tough-cookie@3.0.0',
      storeType: 'MemoryCookieStore',
      rejectPublicSuffixes: true,
      cookies: mapped,
    })
  );
}
