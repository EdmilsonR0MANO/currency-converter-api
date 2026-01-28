#!/usr/bin/env node

/**
 * Script para gerar uma API Key segura
 * Uso: node scripts/generate-api-key.js
 */

const crypto = require('crypto');

// Gera uma API Key segura com 32 bytes (64 caracteres hexadecimais)
const apiKey = crypto.randomBytes(32).toString('hex');

console.log('\n🔐 API Key Gerada com Sucesso!\n');
console.log('═'.repeat(70));
console.log(`\n  API_KEY=${apiKey}\n`);
console.log('═'.repeat(70));
console.log('\n📋 Instruções:\n');
console.log('1. Copie a API Key acima');
console.log('2. Cole no arquivo .env na variável API_KEY');
console.log('3. Reinicie o servidor se estiver rodando\n');
console.log('Exemplo de uso no .env:');
console.log(`  API_KEY=${apiKey}\n`);
console.log('Exemplo de uso no header da requisição:');
console.log(`  x-api-key: ${apiKey}\n`);
