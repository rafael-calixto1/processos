// Deve ser o primeiro import dos testes que usam banco: define o ambiente antes de src/config/database.js criar o pool.
// Nunca roda fora de um banco com "test" no nome (os testes derrubam e recriam todas as tabelas).
process.env.DB_NAME = process.env.DB_NAME || 'processo_audit_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
if (!/test/.test(process.env.DB_NAME)) throw new Error('Testes só rodam em banco com "test" no nome');
