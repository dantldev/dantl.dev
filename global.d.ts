interface DecodedUser {
  timestamp: number;
  privileges: string[];
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      [key: string]: string;
    }
  }
}
