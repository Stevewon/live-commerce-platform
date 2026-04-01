/**
 * Cloudflare D1 네이티브 SQL 래퍼
 * Prisma 스타일 API를 D1 SQL로 변환
 * 
 * Usage:
 *   import { getPrisma } from '@/lib/prisma';
 *   const prisma = await getPrisma();
 *   const users = await prisma.user.findMany();
 */

type D1DB = any; // D1Database type

// D1 바인딩을 가져오는 함수
async function getD1(): Promise<D1DB> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const ctx = await getCloudflareContext();
  return (ctx.env as any).DB;
}

// 유틸리티 함수
function buildWhere(where: any): { sql: string; params: any[] } {
  if (!where || Object.keys(where).length === 0) return { sql: '', params: [] };
  
  const conditions: string[] = [];
  const params: any[] = [];
  
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    if (value === null) {
      conditions.push(`"${key}" IS NULL`);
    } else if (typeof value === 'object' && value !== null) {
      const obj = value as any;
      if ('contains' in obj) {
        conditions.push(`"${key}" LIKE ?`);
        params.push(`%${obj.contains}%`);
      } else if ('in' in obj) {
        const placeholders = obj.in.map(() => '?').join(',');
        conditions.push(`"${key}" IN (${placeholders})`);
        params.push(...obj.in);
      } else if ('gte' in obj) {
        conditions.push(`"${key}" >= ?`);
        params.push(obj.gte);
      } else if ('lte' in obj) {
        conditions.push(`"${key}" <= ?`);
        params.push(obj.lte);
      } else if ('not' in obj) {
        conditions.push(`"${key}" != ?`);
        params.push(obj.not);
      } else if ('mode' in obj && 'contains' in obj) {
        conditions.push(`"${key}" LIKE ?`);
        params.push(`%${obj.contains}%`);
      }
    } else {
      conditions.push(`"${key}" = ?`);
      params.push(value === true ? 1 : value === false ? 0 : value);
    }
  }
  
  return { 
    sql: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '', 
    params 
  };
}

function buildOrderBy(orderBy: any): string {
  if (!orderBy) return '';
  if (Array.isArray(orderBy)) {
    return ' ORDER BY ' + orderBy.map((o: any) => {
      const [key, dir] = Object.entries(o)[0];
      return `"${key}" ${(dir as string).toUpperCase()}`;
    }).join(', ');
  }
  const [key, dir] = Object.entries(orderBy)[0];
  return ` ORDER BY "${key}" ${(dir as string).toUpperCase()}`;
}

function convertRow(row: any): any {
  if (!row) return row;
  const result: any = {};
  for (const [key, value] of Object.entries(row)) {
    // SQLite stores booleans as 0/1
    if (key === 'isActive' || key === 'isFeatured' || key === 'isLive' || 
        key === 'isRead' || key === 'isDeleted' || key === 'isReported' || key === 'hasOptions') {
      result[key] = value === 1 || value === true;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// 모델 CRUD 프록시 생성
function createModelProxy(db: D1DB, tableName: string) {
  return {
    async findMany(args?: any) {
      let sql = `SELECT * FROM "${tableName}"`;
      let params: any[] = [];
      
      if (args?.where) {
        const w = buildWhere(args.where);
        sql += w.sql;
        params = w.params;
      }
      
      if (args?.orderBy) {
        sql += buildOrderBy(args.orderBy);
      } else {
        sql += ` ORDER BY "createdAt" DESC`;
      }
      
      if (args?.take || args?.limit) {
        sql += ` LIMIT ${args.take || args.limit}`;
      }
      if (args?.skip || args?.offset) {
        sql += ` OFFSET ${args.skip || args.offset}`;
      }
      
      const result = await db.prepare(sql).bind(...params).all();
      let rows = (result.results || []).map(convertRow);
      
      // Handle includes (basic relations)
      if (args?.include) {
        rows = await resolveIncludes(db, tableName, rows, args.include);
      }
      
      return rows;
    },
    
    async findUnique(args: any) {
      const w = buildWhere(args.where);
      const sql = `SELECT * FROM "${tableName}"${w.sql} LIMIT 1`;
      const row = await db.prepare(sql).bind(...w.params).first();
      if (!row) return null;
      
      let result = convertRow(row);
      if (args?.include) {
        const rows = await resolveIncludes(db, tableName, [result], args.include);
        result = rows[0];
      }
      return result;
    },
    
    async findFirst(args?: any) {
      let sql = `SELECT * FROM "${tableName}"`;
      let params: any[] = [];
      
      if (args?.where) {
        const w = buildWhere(args.where);
        sql += w.sql;
        params = w.params;
      }
      if (args?.orderBy) {
        sql += buildOrderBy(args.orderBy);
      }
      sql += ' LIMIT 1';
      
      const row = await db.prepare(sql).bind(...params).first();
      if (!row) return null;
      
      let result = convertRow(row);
      if (args?.include) {
        const rows = await resolveIncludes(db, tableName, [result], args.include);
        result = rows[0];
      }
      return result;
    },
    
    async create(args: any) {
      const data = { ...args.data };
      
      // Extract nested relation creates (e.g., items: { create: [...] })
      const nestedCreates: Record<string, any[]> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && (value as any).create) {
          nestedCreates[key] = Array.isArray((value as any).create) ? (value as any).create : [(value as any).create];
          delete data[key];
        }
      }
      
      // Filter out undefined values - D1 does not support undefined
      const filteredKeys: string[] = [];
      const filteredValues: any[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue; // Skip undefined values
        filteredKeys.push(key);
        const v = value;
        if (v === true) filteredValues.push(1);
        else if (v === false) filteredValues.push(0);
        else if (v instanceof Date) filteredValues.push(v.toISOString());
        else filteredValues.push(v);
      }
      
      // Generate UUID if id not provided
      if (!filteredKeys.includes('id')) {
        filteredKeys.unshift('id');
        filteredValues.unshift(crypto.randomUUID());
      }
      
      // Add timestamps
      const now = new Date().toISOString();
      if (!filteredKeys.includes('createdAt')) {
        filteredKeys.push('createdAt');
        filteredValues.push(now);
      }
      if (!filteredKeys.includes('updatedAt')) {
        filteredKeys.push('updatedAt');
        filteredValues.push(now);
      }
      
      const placeholders = filteredKeys.map(() => '?').join(',');
      const sql = `INSERT INTO "${tableName}" (${filteredKeys.map(k => `"${k}"`).join(',')}) VALUES (${placeholders}) RETURNING *`;
      
      const result = await db.prepare(sql).bind(...filteredValues).first();
      let createdRow = convertRow(result);
      
      // Handle nested relation creates
      const relations = RELATIONS[tableName] || {};
      for (const [relName, items] of Object.entries(nestedCreates)) {
        const rel = relations[relName];
        if (rel && rel.type === 'many') {
          createdRow[relName] = [];
          for (const item of items) {
            const nestedData = { ...item, [rel.foreignKey]: createdRow.id };
            const nestedRow = await createModelProxy(db, rel.table).create({ data: nestedData });
            // Resolve nested includes if requested
            if (args.include && args.include[relName] && args.include[relName].include) {
              const resolved = await resolveIncludes(db, rel.table, [nestedRow], args.include[relName].include);
              createdRow[relName].push(resolved[0]);
            } else {
              createdRow[relName].push(nestedRow);
            }
          }
        }
      }
      
      // Resolve remaining includes
      if (args?.include) {
        for (const [relName, relConfig] of Object.entries(args.include)) {
          if (!relConfig || nestedCreates[relName]) continue; // Skip already resolved
          const rel = relations[relName];
          if (!rel) continue;
          if (rel.type === 'one') {
            const fkValue = createdRow[rel.foreignKey];
            if (fkValue) {
              const related = await db.prepare(`SELECT * FROM "${rel.table}" WHERE "id" = ? LIMIT 1`).bind(fkValue).first();
              createdRow[relName] = related ? convertRow(related) : null;
            } else {
              createdRow[relName] = null;
            }
          } else if (!nestedCreates[relName]) {
            const related = await db.prepare(`SELECT * FROM "${rel.table}" WHERE "${rel.foreignKey}" = ?`).bind(createdRow.id).all();
            createdRow[relName] = (related.results || []).map(convertRow);
          }
        }
      }
      
      return createdRow;
    },
    
    async update(args: any) {
      const data = { ...args.data };
      const w = buildWhere(args.where);
      
      // Add updatedAt
      if (!data.updatedAt) {
        data.updatedAt = new Date().toISOString();
      }
      
      // Filter out undefined values and handle increment/decrement
      const setClauses: string[] = [];
      const setValues: any[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue; // Skip undefined
        if (value && typeof value === 'object' && !(value instanceof Date)) {
          const obj = value as any;
          if ('increment' in obj) {
            setClauses.push(`"${key}" = "${key}" + ?`);
            setValues.push(obj.increment);
            continue;
          }
          if ('decrement' in obj) {
            setClauses.push(`"${key}" = "${key}" - ?`);
            setValues.push(obj.decrement);
            continue;
          }
        }
        setClauses.push(`"${key}" = ?`);
        const v = value;
        if (v === true) setValues.push(1);
        else if (v === false) setValues.push(0);
        else if (v instanceof Date) setValues.push(v.toISOString());
        else setValues.push(v);
      }
      
      if (setClauses.length === 0) {
        // Nothing to update, just return current
        const selectSql = `SELECT * FROM "${tableName}"${w.sql} LIMIT 1`;
        const row = await db.prepare(selectSql).bind(...w.params).first();
        let result = convertRow(row);
        if (args?.include && result) {
          const rows = await resolveIncludes(db, tableName, [result], args.include);
          result = rows[0];
        }
        return result;
      }
      
      const sql = `UPDATE "${tableName}" SET ${setClauses.join(', ')}${w.sql} RETURNING *`;
      const result = await db.prepare(sql).bind(...setValues, ...w.params).first();
      let updatedRow = convertRow(result);
      
      // Handle includes
      if (args?.include && updatedRow) {
        const relations = RELATIONS[tableName] || {};
        for (const [relName, relConfig] of Object.entries(args.include)) {
          if (!relConfig) continue;
          const rel = relations[relName];
          if (!rel) continue;
          if (rel.type === 'one') {
            const fkValue = updatedRow[rel.foreignKey];
            if (fkValue) {
              const selectFields = typeof relConfig === 'object' && (relConfig as any).select
                ? Object.keys((relConfig as any).select).map(f => `"${f}"`).join(', ')
                : '*';
              const related = await db.prepare(`SELECT ${selectFields} FROM "${rel.table}" WHERE "id" = ? LIMIT 1`).bind(fkValue).first();
              updatedRow[relName] = related ? convertRow(related) : null;
            } else {
              updatedRow[relName] = null;
            }
          } else {
            const related = await db.prepare(`SELECT * FROM "${rel.table}" WHERE "${rel.foreignKey}" = ?`).bind(updatedRow.id).all();
            let relRows = (related.results || []).map(convertRow);
            // Nested includes
            if (typeof relConfig === 'object' && (relConfig as any).include) {
              relRows = await resolveIncludes(db, rel.table, relRows, (relConfig as any).include);
            }
            updatedRow[relName] = relRows;
          }
        }
      }
      
      return updatedRow;
    },
    
    async delete(args: any) {
      const w = buildWhere(args.where);
      const sql = `DELETE FROM "${tableName}"${w.sql} RETURNING *`;
      const result = await db.prepare(sql).bind(...w.params).first();
      return convertRow(result);
    },
    
    async count(args?: any) {
      let sql = `SELECT COUNT(*) as count FROM "${tableName}"`;
      let params: any[] = [];
      
      if (args?.where) {
        const w = buildWhere(args.where);
        sql += w.sql;
        params = w.params;
      }
      
      const result = await db.prepare(sql).bind(...params).first() as any;
      return result?.count || 0;
    },
    
    async aggregate(args?: any) {
      let sql = 'SELECT';
      const parts: string[] = [];
      
      if (args?._count) {
        parts.push('COUNT(*) as _count');
      }
      if (args?._sum) {
        for (const field of Object.keys(args._sum)) {
          parts.push(`SUM("${field}") as "${field}"`);
        }
      }
      if (args?._avg) {
        for (const field of Object.keys(args._avg)) {
          parts.push(`AVG("${field}") as "${field}"`);
        }
      }
      
      sql += ` ${parts.join(', ')} FROM "${tableName}"`;
      let params: any[] = [];
      
      if (args?.where) {
        const w = buildWhere(args.where);
        sql += w.sql;
        params = w.params;
      }
      
      const result = await db.prepare(sql).bind(...params).first() as any;
      
      const output: any = {};
      if (args?._count) output._count = result?._count || 0;
      if (args?._sum) {
        output._sum = {};
        for (const field of Object.keys(args._sum)) {
          output._sum[field] = result?.[field] || 0;
        }
      }
      return output;
    },

    async groupBy(args?: any) {
      const by = args?.by || [];
      const selectParts = by.map((f: string) => `"${f}"`);
      
      if (args?._count) {
        selectParts.push('COUNT(*) as _count');
      }
      if (args?._sum) {
        for (const field of Object.keys(args._sum)) {
          selectParts.push(`SUM("${field}") as "${field}"`);
        }
      }
      
      let sql = `SELECT ${selectParts.join(', ')} FROM "${tableName}"`;
      let params: any[] = [];
      
      if (args?.where) {
        const w = buildWhere(args.where);
        sql += w.sql;
        params = w.params;
      }
      
      sql += ` GROUP BY ${by.map((f: string) => `"${f}"`).join(', ')}`;
      
      if (args?.orderBy) {
        sql += buildOrderBy(args.orderBy);
      }
      
      const result = await db.prepare(sql).bind(...params).all();
      return result.results || [];
    },
    
    async updateMany(args: any) {
      const data = { ...args.data };
      const w = buildWhere(args.where);
      
      if (!data.updatedAt) data.updatedAt = new Date().toISOString();
      
      const setClauses: string[] = [];
      const setValues: any[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (value === undefined) continue;
        if (value && typeof value === 'object' && !(value instanceof Date)) {
          const obj = value as any;
          if ('increment' in obj) { setClauses.push(`"${key}" = "${key}" + ?`); setValues.push(obj.increment); continue; }
          if ('decrement' in obj) { setClauses.push(`"${key}" = "${key}" - ?`); setValues.push(obj.decrement); continue; }
        }
        setClauses.push(`"${key}" = ?`);
        if (value === true) setValues.push(1);
        else if (value === false) setValues.push(0);
        else setValues.push(value);
      }
      
      const sql = `UPDATE "${tableName}" SET ${setClauses.join(', ')}${w.sql}`;
      const result = await db.prepare(sql).bind(...setValues, ...w.params).run();
      return { count: result.meta.changes };
    },

    async deleteMany(args?: any) {
      let sql = `DELETE FROM "${tableName}"`;
      let params: any[] = [];
      
      if (args?.where) {
        const w = buildWhere(args.where);
        sql += w.sql;
        params = w.params;
      }
      
      const result = await db.prepare(sql).bind(...params).run();
      return { count: result.meta.changes };
    },

    async createMany(args: any) {
      const items = args.data || [];
      const results: any[] = [];
      for (const item of items) {
        const row = await createModelProxy(db, tableName).create({ data: item });
        results.push(row);
      }
      return { count: results.length };
    },

    async upsert(args: any) {
      const w = buildWhere(args.where);
      const sql = `SELECT * FROM "${tableName}"${w.sql} LIMIT 1`;
      const existing = await db.prepare(sql).bind(...w.params).first();
      
      if (existing) {
        return await createModelProxy(db, tableName).update({ where: args.where, data: args.update });
      } else {
        return await createModelProxy(db, tableName).create({ data: args.create });
      }
    },
  };
}

// 관계 해결 (기본적인 include 지원)
const RELATIONS: Record<string, Record<string, { table: string; foreignKey: string; type: 'one' | 'many' }>> = {
  User: {
    partner: { table: 'Partner', foreignKey: 'userId', type: 'one' },
    orders: { table: 'Order', foreignKey: 'userId', type: 'many' },
    cartItems: { table: 'CartItem', foreignKey: 'userId', type: 'many' },
    notifications: { table: 'Notification', foreignKey: 'userId', type: 'many' },
  },
  Product: {
    category: { table: 'Category', foreignKey: 'categoryId', type: 'one' },
    variants: { table: 'ProductVariant', foreignKey: 'productId', type: 'many' },
    partnerProducts: { table: 'PartnerProduct', foreignKey: 'productId', type: 'many' },
    reviews: { table: 'Review', foreignKey: 'productId', type: 'many' },
    orderItems: { table: 'OrderItem', foreignKey: 'productId', type: 'many' },
  },
  ProductVariant: {
    product: { table: 'Product', foreignKey: 'productId', type: 'one' },
    orderItems: { table: 'OrderItem', foreignKey: 'variantId', type: 'many' },
    cartItems: { table: 'CartItem', foreignKey: 'variantId', type: 'many' },
  },
  Partner: {
    user: { table: 'User', foreignKey: 'userId', type: 'one' },
    products: { table: 'PartnerProduct', foreignKey: 'partnerId', type: 'many' },
    liveStreams: { table: 'LiveStream', foreignKey: 'partnerId', type: 'many' },
    orders: { table: 'Order', foreignKey: 'partnerId', type: 'many' },
    settlements: { table: 'Settlement', foreignKey: 'partnerId', type: 'many' },
  },
  Order: {
    user: { table: 'User', foreignKey: 'userId', type: 'one' },
    partner: { table: 'Partner', foreignKey: 'partnerId', type: 'one' },
    items: { table: 'OrderItem', foreignKey: 'orderId', type: 'many' },
    review: { table: 'Review', foreignKey: 'orderId', type: 'one' },
    coupon: { table: 'Coupon', foreignKey: 'couponId', type: 'one' },
  },
  OrderItem: {
    product: { table: 'Product', foreignKey: 'productId', type: 'one' },
    order: { table: 'Order', foreignKey: 'orderId', type: 'one' },
  },
  LiveStream: {
    partner: { table: 'Partner', foreignKey: 'partnerId', type: 'one' },
    chatMessages: { table: 'LiveChat', foreignKey: 'liveStreamId', type: 'many' },
  },
  LiveChat: {
    user: { table: 'User', foreignKey: 'userId', type: 'one' },
    liveStream: { table: 'LiveStream', foreignKey: 'liveStreamId', type: 'one' },
  },
  PartnerProduct: {
    partner: { table: 'Partner', foreignKey: 'partnerId', type: 'one' },
    product: { table: 'Product', foreignKey: 'productId', type: 'one' },
  },
  Review: {
    product: { table: 'Product', foreignKey: 'productId', type: 'one' },
    user: { table: 'User', foreignKey: 'userId', type: 'one' },
    order: { table: 'Order', foreignKey: 'orderId', type: 'one' },
  },
  CartItem: {
    user: { table: 'User', foreignKey: 'userId', type: 'one' },
    product: { table: 'Product', foreignKey: 'productId', type: 'one' },
  },
  WishlistItem: {
    user: { table: 'User', foreignKey: 'userId', type: 'one' },
    product: { table: 'Product', foreignKey: 'productId', type: 'one' },
  },
  Category: {
    products: { table: 'Product', foreignKey: 'categoryId', type: 'many' },
    parent: { table: 'Category', foreignKey: 'parentId', type: 'one' },
    children: { table: 'Category', foreignKey: 'parentId', type: 'many' },
  },
  Settlement: {
    partner: { table: 'Partner', foreignKey: 'partnerId', type: 'one' },
  },
  Notification: {
    user: { table: 'User', foreignKey: 'userId', type: 'one' },
  },
  Coupon: {
    orders: { table: 'Order', foreignKey: 'couponId', type: 'many' },
  },
};

async function resolveIncludes(db: D1DB, tableName: string, rows: any[], include: any) {
  const relations = RELATIONS[tableName] || {};
  
  for (const [relName, relConfig] of Object.entries(include)) {
    if (!relConfig) continue;
    const rel = relations[relName];
    if (!rel) continue;
    
    // select 옵션 처리
    const selectFields = typeof relConfig === 'object' && (relConfig as any).select 
      ? Object.keys((relConfig as any).select).map(f => `"${f}"`).join(', ')
      : '*';
    
    for (const row of rows) {
      if (rel.type === 'one') {
        // 외래키가 현재 테이블에 있는 경우 (예: Product.category -> categoryId)
        const fkValue = row[rel.foreignKey];
        if (fkValue) {
          const related = await db.prepare(
            `SELECT ${selectFields} FROM "${rel.table}" WHERE "id" = ? LIMIT 1`
          ).bind(fkValue).first();
          row[relName] = related ? convertRow(related) : null;
        } else {
          // 외래키가 관련 테이블에 있는 경우 (예: User.partner -> Partner.userId)
          const related = await db.prepare(
            `SELECT ${selectFields} FROM "${rel.table}" WHERE "${rel.foreignKey}" = ? LIMIT 1`
          ).bind(row.id).first();
          row[relName] = related ? convertRow(related) : null;
        }
      } else {
        // many 관계
        let relWhere: any = {};
        if (typeof relConfig === 'object' && (relConfig as any).where) {
          relWhere = (relConfig as any).where;
        }
        
        const w = buildWhere(relWhere);
        let sql = `SELECT ${selectFields} FROM "${rel.table}" WHERE "${rel.foreignKey}" = ?${w.sql ? ' AND' + w.sql.substring(6) : ''}`;
        
        if (typeof relConfig === 'object' && (relConfig as any).orderBy) {
          sql += buildOrderBy((relConfig as any).orderBy);
        }
        if (typeof relConfig === 'object' && (relConfig as any).take) {
          sql += ` LIMIT ${(relConfig as any).take}`;
        }
        
        const related = await db.prepare(sql).bind(row.id, ...w.params).all();
        row[relName] = (related.results || []).map(convertRow);
        
        // Nested includes
        if (typeof relConfig === 'object' && (relConfig as any).include) {
          row[relName] = await resolveIncludes(db, rel.table, row[relName], (relConfig as any).include);
        }
      }
    }
  }
  
  return rows;
}

// 메인 DB 프록시 - Prisma 스타일 API 제공
function createDbProxy(db: D1DB) {
  const models: Record<string, string> = {
    user: 'User',
    account: 'Account', 
    session: 'Session',
    verificationToken: 'VerificationToken',
    partner: 'Partner',
    category: 'Category',
    product: 'Product',
    partnerProduct: 'PartnerProduct',
    liveStream: 'LiveStream',
    order: 'Order',
    orderItem: 'OrderItem',
    settlement: 'Settlement',
    cartItem: 'CartItem',
    wishlistItem: 'WishlistItem',
    review: 'Review',
    coupon: 'Coupon',
    notification: 'Notification',
    liveChat: 'LiveChat',
    productVariant: 'ProductVariant',
  };
  
  const proxy: any = {
    $disconnect: async () => {},
    $transaction: async (fn: any) => {
      // D1 doesn't support real transactions, but we can execute sequentially
      if (typeof fn === 'function') {
        return await fn(proxy);
      }
      // Array of promises
      return Promise.all(fn);
    },
    $queryRaw: async (query: any, ...params: any[]) => {
      const sql = typeof query === 'string' ? query : query.strings.join('?');
      const result = await db.prepare(sql).bind(...params).all();
      return result.results || [];
    },
  };
  
  for (const [modelName, tableName] of Object.entries(models)) {
    proxy[modelName] = createModelProxy(db, tableName);
  }
  
  return proxy;
}

// 로컬 개발용 Prisma 클라이언트 캐시
let _prismaClient: any = null;

// API: getPrisma() - 모든 API 라우트에서 사용
export async function getPrisma(): Promise<any> {
  try {
    const db = await getD1();
    if (db) return createDbProxy(db);
  } catch {
    // 로컬 개발 환경
  }
  
  // 로컬 개발 fallback - 싱글톤 패턴
  if (!_prismaClient) {
    const { PrismaClient } = await import('@prisma/client');
    const path = await import('path');
    const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
    _prismaClient = new PrismaClient({
      datasources: {
        db: { url: `file:${dbPath}` }
      }
    });
  }
  return _prismaClient;
}

export const getDb = getPrisma;
export default getPrisma;
