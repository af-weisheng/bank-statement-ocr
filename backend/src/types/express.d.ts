declare global {
  namespace Express {
    interface Request {
      /** Populated by authenticateUser middleware */
      user?: {
        email: string;
        domain: string;
      };
      /** Populated by authenticateAdmin middleware */
      admin?: {
        email: string;
        is_super_admin: boolean;
      };
    }
  }
}

export {};
