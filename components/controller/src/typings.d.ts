import 'mongoose';

declare module 'mongoose' {
  interface PaginateOptions {
    sortBy?: string;
    populate?: string;
    limit?: number;
    page?: number;
  }

  interface QueryResult<T> {
    results: T[];
    page: number;
    limit: number;
    totalPages: number;
    totalResults: number;
  }

  interface PaginateModel<T extends Document> extends Model<T> {
    paginate(filter: FilterQuery<T>, options: PaginateOptions): Promise<QueryResult<T>>;
  }
}
declare global {
  interface Error {
    statusCode?: number;
    subcode?: number;
  }
}

