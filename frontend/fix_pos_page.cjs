const fs = require('fs');
let content = fs.readFileSync('src/pages/pos/PosPage.tsx', 'utf8');

// 1. Add import
content = content.replace(
  /import AdminLayout, \{ Icon \} from "\.\.\/\.\.\/layouts\/AdminLayout";/,
  `import AdminLayout, { Icon } from "../../layouts/AdminLayout";\nimport { useAppNotifications } from "../../components/common/AppNotificationsContext";`
);

// 2. Replace errorMessage
content = content.replace(/const \[errorMessage, setErrorMessage\] = useState\(""\);/, 'const { notify } = useAppNotifications();');
content = content.replace(/setErrorMessage\(""\);\r?\n?/g, '');
content = content.replace(/setErrorMessage\(\s*([\s\S]*?)\s*\);/g, (match, p1) => {
  return `notify(\n${p1},\n"error"\n);`;
});
content = content.replace(/\s*\{errorMessage \? \(\s*<div className=".*?"(?:>|\s+.*?>)\s*\{errorMessage\}\s*<\/div>\s*\) : null\}/g, '');

// 3. Fix stockQuantity TypeScript issues
content = content.replace(/stockQuantity !== null/g, 'stockQuantity != null');
content = content.replace(/item\.product\.stockQuantity\s*\n\s*: 9999/g, '(item.product.stockQuantity as number)\n        : 9999');

fs.writeFileSync('src/pages/pos/PosPage.tsx', content);
console.log("Done");
