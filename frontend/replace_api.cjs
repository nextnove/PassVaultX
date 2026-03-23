const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const wailsImports = new Set();
let currentFile = "";

walkDir(srcDir, function(filePath) {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Replace window.passVaultXAPI.method(...) with Method(...)
    content = content.replace(/window\.passVaultXAPI\.([a-zA-Z0-9_]+)/g, (match, p1) => {
      let upperMethod = p1.charAt(0).toUpperCase() + p1.slice(1);
      
      // Calculate relative path to wailsjs/go/main/App
      let depth = filePath.replace(srcDir, '').split(path.sep).length - 1;
      let relativePrefix = '../'.repeat(depth) + '../wailsjs/go/main/App';
      // In src/App.tsx, depth is 0 -> ../wailsjs
      // In src/stores/vaultStore.ts, depth is 1 -> ../../wailsjs

      if (filePath === path.join(srcDir, 'App.tsx')) {
        relativePrefix = '../wailsjs/go/main/App';
      }

      // Add to imports if not already added in this file
      if (!content.includes(`import { ${upperMethod} }`)) {
        if (!content.includes('wailsjs/go/main/App')) {
          content = `import { ${upperMethod} } from '${relativePrefix}';\n` + content;
        } else {
          // just inject into existing import
          let regex = new RegExp(`import {([^}]*)} from '${relativePrefix}';`);
          if (regex.test(content)) {
            content = content.replace(regex, (m, imports) => {
               if(!imports.includes(upperMethod)) {
                   return `import {${imports}, ${upperMethod}} from '${relativePrefix}';`;
               }
               return m;
            });
          }
        }
      }
      
      return upperMethod;
    });

    if (original !== content) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Updated', filePath);
    }
  }
});
