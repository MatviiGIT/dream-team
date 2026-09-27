import type { GameState } from '../domain/types';

const STORAGE_KEY = 'dream-team:wsc:careers:v3';

export interface StoredCareer {
  id: string;
  managerName: string;
  clubName: string;
  createdAt: string;
  updatedAt: string;
  state: GameState;
}

export function loadCareers(): StoredCareer[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as StoredCareer[];
    return Array.isArray(list)
      ? list.filter(x => x?.state?.saveVersion === 3 && x.id === x.state.careerId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
      : [];
  } catch {
    return [];
  }
}

export function saveGame(state: GameState): void {
  const careers=loadCareers().filter(x=>x.id!==state.careerId);
  careers.push({id:state.careerId,managerName:state.managerName,clubName:state.clubs[state.clubId]?.name??'Club',createdAt:state.createdAt,updatedAt:state.updatedAt,state});
  localStorage.setItem(STORAGE_KEY,JSON.stringify(careers));
}

export function deleteCareer(id:string):void {
  localStorage.setItem(STORAGE_KEY,JSON.stringify(loadCareers().filter(x=>x.id!==id)));
}
