import type { PlatformAdapter } from './types';
import { getonbrd } from './getonbrd';

// Se agregan acá a medida que se integra cada plataforma (ver PLAN.md, etapas).
export const adapters: PlatformAdapter[] = [getonbrd];
