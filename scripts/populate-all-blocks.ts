/**
 * Script para popular todos os 50 blocos UX na tabela
 * Execute: npx tsx scripts/populate-all-blocks.ts
 */

import { uxBlocks } from './ux-blocks-data';

// Importar via MCP Supabase
// Este script deve ser executado manualmente ou via MCP

console.log(`📦 Total de blocos: ${uxBlocks.length}\n`);

// Gerar SQL para inserção em lote
console.log('-- SQL para inserir todos os blocos\n');
console.log('BEGIN;\n');

uxBlocks.forEach((block, index) => {
  const semanticFlowJson = JSON.stringify(block.semantic_flow).replace(/'/g, "''");
  const useCasesArray = `ARRAY[${block.use_cases.map((uc) => `'${uc.replace(/'/g, "''")}'`).join(", ")}]`;
  const referencesArray = block.block_references.length > 0 
    ? `ARRAY[${block.block_references.map((ref) => `'${ref.replace(/'/g, "''")}'`).join(", ")}]`
    : `ARRAY[]::TEXT[]`;
  
  console.log(`
-- Bloco ${index + 1}: ${block.label}
INSERT INTO ux_blocks (id, label, description, use_cases, archetype, semantic_flow, block_references)
VALUES (
  '${block.id}',
  '${block.label.replace(/'/g, "''")}',
  '${block.description.replace(/'/g, "''")}',
  ${useCasesArray},
  '${block.archetype}',
  '${semanticFlowJson}'::jsonb,
  ${referencesArray}
)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  use_cases = EXCLUDED.use_cases,
  archetype = EXCLUDED.archetype,
  semantic_flow = EXCLUDED.semantic_flow,
  block_references = EXCLUDED.block_references,
  updated_at = NOW();
`);
});

console.log('COMMIT;');
console.log(`\n✨ SQL gerado para ${uxBlocks.length} blocos`);









