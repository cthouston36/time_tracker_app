import { getSql } from "@/lib/db";
import { runSuiteQLAll } from "@/lib/netsuite/client";

const NETSUITE_VENDOR_TABLE = "vendor";

export type NetSuiteVendor = {
  id: string;
  name: string;
  entityId?: string;
  companyName?: string;
  defaultAddress: string;
};

export type NetSuiteVendorBlacklistById = Record<string, true>;

export type NetSuiteVendorCache = {
  allVendors: NetSuiteVendor[];
  syncedAt: string | null;
  vendorBlacklistById: NetSuiteVendorBlacklistById;
  vendors: NetSuiteVendor[];
};

type NetSuiteVendorRow = Record<string, unknown> & {
  alt_name?: unknown;
  company_name?: unknown;
  default_address?: unknown;
  default_billing?: unknown;
  default_shipping?: unknown;
  entity_id?: unknown;
  vendor_id?: unknown;
};

type NetSuiteVendorCacheRow = {
  company_name: string | null;
  default_address: string;
  entity_id: string | null;
  id: string;
  name: string;
  raw_data: unknown;
  synced_at: string | Date | null;
};

type NetSuiteVendorBlacklistRow = {
  vendor_id: string;
};

let vendorCacheTableReady = false;

export async function syncNetSuiteVendors() {
  const vendors = await fetchNetSuiteVendors();
  const cache = await writeCachedNetSuiteVendors(vendors);

  if (!cache) {
    throw new Error("Database is not configured, so NetSuite vendors cannot be cached.");
  }

  return {
    vendors,
    syncedAt: cache.syncedAt
  };
}

export async function readCachedNetSuiteVendors() {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureNetSuiteVendorCacheTable();

  const rows = (await sql`
    select
      id,
      name,
      entity_id,
      company_name,
      default_address,
      raw_data,
      synced_at::text as synced_at
    from netsuite_vendors
    order by lower(name), lower(entity_id), id
  `) as NetSuiteVendorCacheRow[];
  const blacklistRows = (await sql`
    select vendor_id
    from netsuite_vendor_blacklist
    order by vendor_id
  `) as NetSuiteVendorBlacklistRow[];
  const vendorBlacklistById: NetSuiteVendorBlacklistById = {};

  for (const row of blacklistRows) {
    vendorBlacklistById[row.vendor_id] = true;
  }

  const allVendors = rows.map((row) => ({
    id: row.id,
    name: row.name,
    entityId: row.entity_id ?? undefined,
    companyName: row.company_name ?? undefined,
    defaultAddress: row.default_address
  }));

  return {
    allVendors,
    syncedAt: toIsoDateString(rows[0]?.synced_at) ?? null,
    vendorBlacklistById,
    vendors: allVendors.filter((vendor) => !vendorBlacklistById[vendor.id])
  } satisfies NetSuiteVendorCache;
}

export async function setNetSuiteVendorBlacklist(vendorId: string, blacklisted: boolean) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureNetSuiteVendorCacheTable();

  const normalizedVendorId = readString(vendorId);

  if (!normalizedVendorId) {
    return false;
  }

  if (blacklisted) {
    await sql`
      insert into netsuite_vendor_blacklist (vendor_id, blacklisted_at)
      values (${normalizedVendorId}, now())
      on conflict (vendor_id) do nothing
    `;
  } else {
    await sql`
      delete from netsuite_vendor_blacklist
      where vendor_id = ${normalizedVendorId}
    `;
  }

  return true;
}

async function fetchNetSuiteVendors() {
  const rows = await fetchNetSuiteVendorRows();
  const vendorsById = new Map<string, NetSuiteVendor>();

  for (const row of rows) {
    const vendor = mapNetSuiteVendor(row);

    if (vendor && !vendorsById.has(vendor.id)) {
      vendorsById.set(vendor.id, vendor);
    }
  }

  return Array.from(vendorsById.values()).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" }) ||
    (left.entityId ?? "").localeCompare(right.entityId ?? "", undefined, { numeric: true, sensitivity: "base" }) ||
    left.id.localeCompare(right.id)
  );
}

async function fetchNetSuiteVendorRows() {
  const queries = buildVendorQueries();
  let lastError: unknown = null;

  for (const query of queries) {
    try {
      return await runSuiteQLAll<NetSuiteVendorRow>(query);
    } catch (error) {
      lastError = error;

      if (!isSuiteQLSchemaError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to fetch NetSuite vendors.");
}

async function writeCachedNetSuiteVendors(vendors: NetSuiteVendor[]) {
  const sql = getSql();

  if (!sql) {
    return null;
  }

  await ensureNetSuiteVendorCacheTable();

  const syncedAt = new Date().toISOString();
  const vendorRows = vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    entity_id: vendor.entityId ?? null,
    company_name: vendor.companyName ?? null,
    default_address: vendor.defaultAddress,
    raw_data: vendor,
    synced_at: syncedAt
  }));

  if (vendorRows.length === 0) {
    await sql`delete from netsuite_vendors`;

    return {
      syncedAt,
      vendors: []
    };
  }

  await sql.transaction([
    sql`
      insert into netsuite_vendors (
        id,
        name,
        entity_id,
        company_name,
        default_address,
        raw_data,
        synced_at,
        updated_at
      )
      select
        id,
        name,
        entity_id,
        company_name,
        default_address,
        raw_data,
        synced_at,
        now()
      from jsonb_to_recordset(${JSON.stringify(vendorRows)}::jsonb) as vendor(
        id text,
        name text,
        entity_id text,
        company_name text,
        default_address text,
        raw_data jsonb,
        synced_at timestamptz
      )
      on conflict (id) do update
      set name = excluded.name,
          entity_id = excluded.entity_id,
          company_name = excluded.company_name,
          default_address = excluded.default_address,
          raw_data = excluded.raw_data,
          synced_at = excluded.synced_at,
          updated_at = now()
    `,
    sql`
      delete from netsuite_vendors
      where id not in (
        select value
        from jsonb_array_elements_text(${JSON.stringify(vendors.map((vendor) => vendor.id))}::jsonb)
      )
    `
  ]);

  return {
    syncedAt,
    vendors
  };
}

async function ensureNetSuiteVendorCacheTable() {
  const sql = getSql();

  if (!sql || vendorCacheTableReady) {
    return;
  }

  await sql`
    create table if not exists netsuite_vendors (
      id text primary key,
      name text not null,
      entity_id text,
      company_name text,
      default_address text not null,
      raw_data jsonb not null default '{}'::jsonb,
      synced_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists netsuite_vendor_blacklist (
      vendor_id text primary key,
      blacklisted_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists netsuite_vendors_name_idx on netsuite_vendors (lower(name))`;
  await sql`create index if not exists netsuite_vendors_entity_id_idx on netsuite_vendors (lower(entity_id))`;

  vendorCacheTableReady = true;
}

function buildVendorQueries() {
  return [
    buildVendorAddressBookQuery("addressbookaddress", true),
    buildVendorAddressBookQuery("addressbookaddress", false),
    buildVendorAddressBookQuery("addrtext", true),
    buildVendorAddressBookQuery("addrtext", false)
  ];
}

function buildVendorAddressBookQuery(addressTextField: string, includeDefaultFlags: boolean) {
  const defaultFlagSelect = includeDefaultFlags
    ? `
      vab.defaultbilling as default_billing,
      vab.defaultshipping as default_shipping`
    : `
      null as default_billing,
      null as default_shipping`;
  const defaultFlagSort = includeDefaultFlags
    ? `,
      case
        when vab.defaultbilling = 'T' then 0
        when vab.defaultshipping = 'T' then 1
        else 2
      end`
    : "";

  return `
    select
      v.id as vendor_id,
      v.entityid as entity_id,
      v.companyname as company_name,
      v.altname as alt_name,
      vab.${addressTextField} as default_address,${defaultFlagSelect}
    from ${NETSUITE_VENDOR_TABLE} v
      join vendorAddressbook vab
        on vab.entity = v.id
    where v.isinactive = 'F'
      and vab.${addressTextField} is not null
    order by
      lower(coalesce(v.companyname, v.altname, v.entityid)),
      v.id${defaultFlagSort}
  `;
}

function mapNetSuiteVendor(row: NetSuiteVendorRow) {
  const id = readString(rowValue(row, "vendor_id", "id"));
  const entityId = readString(rowValue(row, "entity_id"));
  const companyName = readString(rowValue(row, "company_name"));
  const altName = readString(rowValue(row, "alt_name"));
  const defaultAddress = readString(rowValue(row, "default_address"));
  const name = companyName || altName || entityId;

  if (!id || !name || !defaultAddress) {
    return null;
  }

  return {
    id,
    name,
    entityId: entityId || undefined,
    companyName: companyName || undefined,
    defaultAddress
  } satisfies NetSuiteVendor;
}

function rowValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (key in row) {
      return row[key];
    }

    const matchingKey = Object.keys(row).find((rowKey) => rowKey.toLowerCase() === key.toLowerCase());

    if (matchingKey) {
      return row[matchingKey];
    }
  }

  return undefined;
}

function readString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function isSuiteQLSchemaError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /invalid search query|unknown identifier|unknown table|search error occurred/i.test(error.message);
}

function toIsoDateString(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}
