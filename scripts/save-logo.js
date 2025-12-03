/**
 * Script para guardar logos de organizaciones en public/logos/
 * 
 * Este script debe ejecutarse después de que se suba un logo mediante la función Edge.
 * Puede ejecutarse manualmente o integrarse en el proceso de despliegue.
 * 
 * Uso:
 * node scripts/save-logo.js <organizationId> <base64Data> <extension>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const [,, organizationId, base64Data, extension = 'png'] = process.argv;

if (!organizationId || !base64Data) {
  console.error('Uso: node scripts/save-logo.js <organizationId> <base64Data> <extension>');
  process.exit(1);
}

try {
  // Create logos directory structure
  const logosDir = path.join(__dirname, '..', 'public', 'logos', organizationId);
  if (!fs.existsSync(logosDir)) {
    fs.mkdirSync(logosDir, { recursive: true });
  }

  // Decode base64 and save file
  const buffer = Buffer.from(base64Data, 'base64');
  const filePath = path.join(logosDir, `logo.${extension}`);
  
  fs.writeFileSync(filePath, buffer);
  
  console.log(`Logo guardado exitosamente en: ${filePath}`);
} catch (error) {
  console.error('Error al guardar el logo:', error);
  process.exit(1);
}

