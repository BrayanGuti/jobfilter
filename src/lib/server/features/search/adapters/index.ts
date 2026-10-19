import type { PlatformAdapter } from './types';
import { computrabajo } from './computrabajo';
import { elempleo } from './elempleo';
import { getonbrd } from './getonbrd';
import { linkedin } from './linkedin';

// Una entrada por plataforma integrada. Cómo agregar una: docs/plataformas.md
export const adapters: PlatformAdapter[] = [getonbrd, computrabajo, linkedin, elempleo];
