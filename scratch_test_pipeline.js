import { tokenize } from './src/compiler/lexer/lexer.js';
import { parse } from './src/compiler/parser/parser.js';
import { buildAST } from './src/compiler/ast/astBuilder.js';
import { analyze } from './src/compiler/semantic/semanticAnalyzer.js';
import { buildIR } from './src/compiler/ir/irBuilder.js';
import { generateSQL } from './src/compiler/sql/sqlGenerator.js';
import { DATABASE_SCHEMA } from './src/data/schema.js';

const queries = [
  "Show students name and marks",
  "Show students older than 18 and scoring above 75 and from CSE",
  "Show the average marks of students",
  "Show students with salary above 50000"
];

for (const q of queries) {
  console.log('='.repeat(50));
  console.log('Query:', q);
  const lexResult = tokenize(q, DATABASE_SCHEMA);
  console.log('Lex tokens count:', lexResult.tokens?.length, 'Errors:', lexResult.errors);
  console.log('CanonicalQuery:', JSON.stringify(lexResult.canonicalQuery, null, 2));

  const pResult = parse(lexResult.tokens, q, DATABASE_SCHEMA);
  console.log('Parse success:', pResult.success, 'Errors:', pResult.errors);

  if (pResult.success && pResult.tree) {
    const aResult = buildAST(pResult.tree);
    console.log('AST success:', aResult.success, 'Errors:', aResult.errors);

    if (aResult.success && aResult.ast) {
      const sResult = analyze(aResult.ast, DATABASE_SCHEMA);
      console.log('Semantic success:', sResult.success, 'Errors:', sResult.errors);

      if (sResult.success) {
        const iResult = buildIR(sResult.ast);
        console.log('IR success:', iResult.success, 'Errors:', iResult.errors);

        if (iResult.success && iResult.ir) {
          const sqResult = generateSQL(iResult.ir);
          console.log('SQL generated:\n', sqResult.sql);
        }
      }
    }
  }
}
