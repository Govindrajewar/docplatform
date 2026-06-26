import type { ErrorCode } from '../constants/error-codes';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  error: null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiError {
  success: false;
  data: null;
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiFieldError[];
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
