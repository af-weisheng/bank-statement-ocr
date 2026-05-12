export type TransactionType = 'credit' | 'debit';

export type StatementStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  balance?: number;
  reference?: string;
  category?: string;
}

export interface StatementPeriod {
  from: string;
  to: string;
}

export interface BankStatement {
  id: string;
  userId: string;
  bankName: string;
  accountNumber?: string;
  statementPeriod?: StatementPeriod;
  currency: string;
  transactions: Transaction[];
  totalCredits: number;
  totalDebits: number;
  openingBalance?: number;
  closingBalance?: number;
  uploadedAt: Date;
  processedAt?: Date;
  status: StatementStatus;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface StatementSummary {
  id: string;
  bankName: string;
  accountNumber?: string;
  statementPeriod?: StatementPeriod;
  currency: string;
  totalCredits: number;
  totalDebits: number;
  transactionCount: number;
  status: StatementStatus;
  fileName: string;
  uploadedAt: Date;
}

export interface ProcessedStatementData {
  bankName: string;
  accountNumber?: string;
  period?: StatementPeriod;
  currency: string;
  transactions: Omit<Transaction, 'id'>[];
  openingBalance?: number;
  closingBalance?: number;
}
