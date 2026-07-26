/**
 * In-memory master data store.
 * Temporary stand-in until Catalyst Data Store is wired in sub-phase 1A.
 * Loads seed JSON from datastore/seeds/*.
 *
 * Reference: DATABASE_DESIGN.md #2.10 (District/Unit), API_REFERENCE.md "Masters".
 */
import { catalyst } from './datastore';
import { MastersRepository } from './repositories/MastersRepository';

export interface District {
  districtId: number;
  districtName: string;
  stateId: number;
  active: boolean;
}

export interface Unit {
  unitId: number;
  unitName: string;
  districtId: number;
  active: boolean;
}

export async function getDistricts(ctx: any): Promise<District[]> {
  const app = catalyst(ctx) as any;
  const repo = new MastersRepository(app.zcql());
  return await repo.getDistricts();
}

export async function getUnits(ctx: any): Promise<Unit[]> {
  const app = catalyst(ctx) as any;
  const repo = new MastersRepository(app.zcql());
  return await repo.getUnits();
}

export async function getUnitsByDistrict(ctx: any, districtId: number): Promise<Unit[]> {
  const units = await getUnits(ctx);
  return units.filter((u) => u.districtId === districtId);
}
