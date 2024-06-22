import jwtSimple from 'jwt-simple';
import { NextRequest, NextResponse } from 'next/server';

import { config } from '../config';

export const jwtUtils = {
  decode: (jwt: string) => jwtSimple.decode(jwt, config.secret),
  encode: (args: Omit<DecodedUser, 'timestamp'>) => {
    const payload = {
      ...args,
      timestamp: Date.now(),
    };

    return jwtSimple.encode(payload, config.secret, 'HS256');
  }
}

export const authMiddleware = async (req: NextRequest & {
  user?: DecodedUser
}) => {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const decoded = jwtUtils.decode(token);

    if (decoded.timestamp < Date.now() - 1000 * 60 * 60) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    req.user = decoded;
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}