/**
 * Script para popular a tabela ux_blocks diretamente via Supabase
 * Execute: npx tsx scripts/populate-blocks-direct.ts
 */

import { createClient } from '@supabase/supabase-js';

// Importar os blocos
import { uxBlocks } from './ux-blocks-data';

// Configuração do Supabase - você precisa configurar essas variáveis
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kruekfsepwkzezqbgwfc.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não configurada');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateBlocks() {
  console.log(`📦 Inserindo ${uxBlocks.length} blocos UX...\n`);

  for (const block of uxBlocks) {
    try {
      const { data, error } = await supabase
        .from('ux_blocks')
        .upsert({
          id: block.id,
          label: block.label,
          description: block.description,
          use_cases: block.use_cases,
          archetype: block.archetype,
          semantic_flow: block.semantic_flow,
          block_references: block.block_references || [],
        }, {
          onConflict: 'id'
        });

      if (error) {
        console.error(`❌ Erro ao inserir ${block.id}:`, error.message);
      } else {
        console.log(`✅ ${block.id} - ${block.label}`);
      }
    } catch (err: any) {
      console.error(`❌ Erro ao inserir ${block.id}:`, err.message);
    }
  }

  console.log(`\n✨ Concluído! ${uxBlocks.length} blocos processados.`);
}

populateBlocks().catch(console.error);









