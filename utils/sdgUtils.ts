import { SDGS } from '../constants';

export const getSdgInfo = (id: number) => SDGS.find(s => s.id === id);
