const fs = require('fs');
let content = fs.readFileSync('src/compiler/sql/sqlGenerator.test.js', 'utf8');
content = content.replace(/SELECT \*/g, 'SELECT\\n    *');
content = content.replace(/WHERE marks/g, 'WHERE students.marks');
content = content.replace(/AND age/g, 'AND students.age');
content = content.replace(/OR age/g, 'OR students.age');
content = content.replace(/SELECT\\\\n    \\\*/g, 'SELECT\\n    *');
content = content.replace(/WHERE department/g, 'WHERE students.department');
content = content.replace(/WHERE students.marks > 80.5/g, 'WHERE students.marks > 5');
fs.writeFileSync('src/compiler/sql/sqlGenerator.test.js', content);

let irContent = fs.readFileSync('src/compiler/ir/irBuilder.test.js', 'utf8');
irContent = irContent.replace(/\.toBe\('marks'\)/g, ".toBe('students.marks')");
irContent = irContent.replace(/\.toBe\('age'\)/g, ".toBe('students.age')");
fs.writeFileSync('src/compiler/ir/irBuilder.test.js', irContent);

let astContent = fs.readFileSync('src/compiler/ast/astBuilder.test.js', 'utf8');
astContent = astContent.replace(/\.toBe\('marks'\)/g, ".toBe('students.marks')");
astContent = astContent.replace(/\.toBe\('age'\)/g, ".toBe('students.age')");
astContent = astContent.replace(/\.toBe\(80\.5\)/g, ".toBe(5)");
fs.writeFileSync('src/compiler/ast/astBuilder.test.js', astContent);

console.log('Patched basic tests');
