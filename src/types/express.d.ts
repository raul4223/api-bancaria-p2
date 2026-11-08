declare global {
  namespace Express {
    interface Request {
      auth?: { operatorUserId: string };
      serviceSession?: { serviceSessionId: string; customerId: string; operatorUserId: string };
      validatedQuery?: unknown;
      validatedHeaders?: unknown;
    }
  }
}

export {};
