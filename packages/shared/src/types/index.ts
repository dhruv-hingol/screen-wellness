export type ApiResponse<T> =
  | { success: true; data: T; meta?: PaginationMeta }
  | {
      success: false;
      error: { code: string; message: string; details?: unknown };
    };
export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export enum UserRole {
  User = 'USER',
  Admin = 'ADMIN',
}
export enum AssessmentCategory {
  ScreenHabits = 'screen_habits',
  Sleep = 'sleep',
  Physical = 'physical',
  Mental = 'mental',
}
export interface Health {
  status: 'ok';
  service: 'screenwise-api';
}
