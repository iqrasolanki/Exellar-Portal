const fs = require('fs');
const path = require('path');

const outputPath = path.join(__dirname, '..', 'assets', 'js', 'exellar-config.js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://hxwctxkjujiyxmhyvwdw.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'PASTE_SUPABASE_ANON_KEY_HERE';

const content = `window.EXELLAR_CONFIG = {
  supabaseUrl: '${supabaseUrl}',
  supabaseAnonKey: '${supabaseAnonKey}'
};
`;

fs.writeFileSync(outputPath, content, 'utf8');
console.log(`Generated ${outputPath}`);
