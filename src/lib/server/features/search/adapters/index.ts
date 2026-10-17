import type { PlatformAdapter } from './types';
import { computrabajo } from './computrabajo';
import { getonbrd } from './getonbrd';

// Una entrada por plataforma integrada. Cómo agregar una: docs/plataformas.md
export const adapters: PlatformAdapter[] = [getonbrd, computrabajo];
